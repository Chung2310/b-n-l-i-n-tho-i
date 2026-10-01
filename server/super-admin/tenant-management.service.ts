import bcrypt from "bcryptjs";
import { CompanyModel } from "../model/company.model";
import { UserModel } from "../model/user.model";
import { ModuleKey } from "../config/module-keys";
import { filterModulesForBusinessType, resolveBusinessType, type BusinessType } from "../config/business-types";
import { createCompanyAdminUser } from "../utils/company-admin-user";
import { ensureDefaultPayrollPolicy } from "../service/payroll-policy-operations.service";
export type TenantLifecycleStatus = "active" | "suspended" | "archived" | "scheduled-deletion";
export interface TenantRecord { code:string; name:string; ownerEmail:string; createdAt:Date; lifecycleStatus:TenantLifecycleStatus; lifecycleChangedAt?:Date; deletionScheduledAt?:Date|null; retentionEndsAt?:Date|null; deletionReason?:string; businessType?:BusinessType; enabledModules?:ModuleKey[]; }
export interface TenantRepository { create(t:TenantRecord):Promise<TenantRecord>; list():Promise<TenantRecord[]>; get(c:string):Promise<TenantRecord|null>; update(c:string,u:Partial<TenantRecord>):Promise<TenantRecord|null>; }
const normalize=(t:any)=>t?{...t,lifecycleStatus:t.lifecycleStatus||"active"}:t;
const db: TenantRepository = { create: async t => (await CompanyModel.create(t)).toObject() as TenantRecord, list: async () => ((await CompanyModel.find({}).sort({createdAt:-1}).lean()) as any[]).map(normalize), get: async c => normalize(await CompanyModel.findOne({code:c}).lean()), update: async(c,u) => normalize(await CompanyModel.findOneAndUpdate({code:c},{$set:u},{new:true,runValidators:true}).lean()) };
const next:Record<TenantLifecycleStatus,TenantLifecycleStatus[]>={active:["suspended","archived"],suspended:["active","archived"],archived:["active"],"scheduled-deletion":[]};
const code=(v:string)=>{const c=String(v||"").trim().toUpperCase();if(!c)throw Error("Tenant code is required");return c}; const needed=(t:TenantRecord|null,c:string)=>{if(!t)throw Error(`Tenant ${c} not found`);return t};

export interface TenantCreateInput { code:string; name:string; ownerEmail:string; ownerName:string; ownerPassword:string; enabledModules?:unknown; businessType?:string; entityPreset?:string; }

export interface TenantCreateUserInput {
  displayName: string;
  email: string;
  password: string;
  role?: string;
  phone?: string;
  department?: string;
  jobTitle?: string;
}

export interface TenantUpdateUserInput {
  displayName?: string;
  email?: string;
  role?: string;
  phone?: string;
  department?: string;
  jobTitle?: string;
  password?: string;
  disabledAt?: Date | string | null;
}

export class TenantManagementService {
  constructor(private readonly tenants:TenantRepository=db) {}

  async create(v:TenantCreateInput){
    const c=code(v.code),name=String(v.name||"").trim(),ownerEmail=String(v.ownerEmail||"").trim().toLowerCase();
    const ownerName=String(v.ownerName||"").trim(), ownerPassword=String(v.ownerPassword||"");
    if(!name||!ownerEmail) throw Error("Tenant name and owner email are required");
    if(!ownerName) throw Error("Owner name is required");
    if(!ownerPassword || ownerPassword.length < 6) throw Error("Owner password must be at least 6 characters");
    if(await this.tenants.get(c)) throw Error(`Tenant ${c} already exists`);
    if(await UserModel.findOne({ email: ownerEmail })) throw Error(`Owner email "${ownerEmail}" is already in use`);

    const businessType = resolveBusinessType(v.businessType);
    const enabledModules = filterModulesForBusinessType(v.enabledModules, businessType);
    const now=new Date();
    const tenant = await this.tenants.create({code:c,name,ownerEmail,createdAt:now,lifecycleStatus:"active",lifecycleChangedAt:now,deletionScheduledAt:null,retentionEndsAt:null,deletionReason:"",businessType,enabledModules});
    const admin = await createCompanyAdminUser({ companyCode:c, companyName:name, ownerName, ownerEmail, ownerPassword });
    await ensureDefaultPayrollPolicy(c, "system", now).catch((error) => console.error("[tenant.create] Could not seed payroll policy", error));

    return { ...tenant, adminUserId: String(admin._id) };
  }

  list(){return this.tenants.list()}

  async get(v:string){const c=code(v);return needed(await this.tenants.get(c),c)}

  async update(v:string,input:Pick<Partial<TenantRecord>,"name"|"ownerEmail">){const u:Partial<TenantRecord>={};if(input.name!==undefined){if(!String(input.name).trim())throw Error("Tenant name is required");u.name=String(input.name).trim()}if(input.ownerEmail!==undefined){if(!String(input.ownerEmail).trim())throw Error("Owner email is required");u.ownerEmail=String(input.ownerEmail).trim()}if(!Object.keys(u).length)throw Error("No tenant fields to update");const c=code(v);return needed(await this.tenants.update(c,u),c)}

  async updateModules(v:string, input:{ enabledModules?:unknown; businessType?:unknown }){
    const c=code(v);
    const tenant=needed(await this.tenants.get(c),c);
    const businessType = resolveBusinessType(input.businessType ?? tenant.businessType);
    const enabledModules = filterModulesForBusinessType(input.enabledModules, businessType);
    return needed(await this.tenants.update(c,{businessType,enabledModules}),c);
  }

  async transitionLifecycle(v:string,target:Exclude<TenantLifecycleStatus,"scheduled-deletion">){
    const c=code(v),t=needed(await this.tenants.get(c),c);
    const currentStatus=t.lifecycleStatus||"active";
    if(!next[currentStatus].includes(target))throw Error(`Invalid lifecycle transition from ${currentStatus} to ${target}`);
    const now=new Date();
    const updated=needed(await this.tenants.update(c,{lifecycleStatus:target,lifecycleChangedAt:now}),c);
    await UserModel.updateMany({companyCode:c},{$set:{disabledAt: target==="active" ? null : now}});
    return updated;
  }

  async scheduleDeletion(v:string,reason:string,now=new Date(),impactPreview?:Record<string,unknown>,backupEvidenceId?:string){const c=code(v),t=needed(await this.tenants.get(c),c),r=String(reason||"").trim();if(t.lifecycleStatus!=="archived")throw Error("Tenant must be archived before deletion");if(!r)throw Error("Deletion reason is required");if(!impactPreview||!backupEvidenceId)throw Error("impact preview and backup evidence are required");const retentionEndsAt=new Date(now);retentionEndsAt.setUTCDate(retentionEndsAt.getUTCDate()+30);const deletionJob={status:"queued",impactPreview,backupEvidenceId};return needed(await this.tenants.update(c,{lifecycleStatus:"scheduled-deletion",lifecycleChangedAt:now,deletionScheduledAt:now,retentionEndsAt,deletionReason:r,deletionJob} as any),c)}

  async cancelDeletion(v:string){const c=code(v),t=needed(await this.tenants.get(c),c);if(t.lifecycleStatus!=="scheduled-deletion")throw Error("Tenant deletion is not scheduled");return needed(await this.tenants.update(c,{lifecycleStatus:"archived",lifecycleChangedAt:new Date(),deletionScheduledAt:null,retentionEndsAt:null,deletionReason:""}),c)}

  async getSummary(v:string){
    const c=code(v);
    await needed(await this.tenants.get(c),c);
    const [userCountAgg, company] = await Promise.all([
      UserModel.aggregate([{ $match: { companyCode: c } }, { $group: { _id: "$role", count: { $sum: 1 } } }]),
      CompanyModel.findOne({ code: c }).select("enabledModules").lean(),
    ]);
    const usersByRole: Record<string, number> = {};
    let userCount = 0;
    for (const row of userCountAgg) { usersByRole[row._id || "unknown"] = row.count; userCount += row.count; }
    const enabledModulesCount = Array.isArray((company as any)?.enabledModules) ? (company as any).enabledModules.length : 0;
    return { userCount, usersByRole, enabledModulesCount };
  }

  async listUsers(v:string){
    const c=code(v);
    await needed(await this.tenants.get(c),c);
    return UserModel.find({ companyCode: c }).select("displayName email role status disabledAt createdAt phone department jobTitle").sort({ createdAt: -1 }).lean();
  }

  async createUser(v: string, input: TenantCreateUserInput) {
    const c = code(v);
    const tenant = needed(await this.tenants.get(c), c);
    const displayName = String(input.displayName || "").trim();
    const email = String(input.email || "").trim().toLowerCase();
    const password = String(input.password || "");
    const role = String(input.role || "admin").trim();

    if (!displayName) throw new Error("Họ và tên là bắt buộc");
    if (!email) throw new Error("Email là bắt buộc");
    if (!password || password.length < 6) throw new Error("Mật khẩu phải có ít nhất 6 ký tự");

    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      throw new Error(`Email "${email}" đã được sử dụng`);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await UserModel.create({
      email,
      password: hashedPassword,
      displayName,
      role,
      companyCode: c,
      companyName: tenant.name,
      phone: input.phone?.trim() || "",
      department: input.department?.trim() || (role === "admin" ? "Ban Giám Đốc" : "Nhân sự"),
      jobTitle: input.jobTitle?.trim() || (role === "admin" ? "Quản trị viên" : (role === "manager" ? "Quản lý" : "Nhân viên")),
      level: role === "admin" ? 1 : (role === "branch_owner" ? 2 : (role === "manager" ? 3 : 4)),
      status: "offline",
      createdAt: new Date(),
      photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random&color=fff`,
    });

    const userObj = user.toObject();
    delete (userObj as any).password;
    return userObj;
  }

  async updateUser(v: string, userId: string, input: TenantUpdateUserInput) {
    const c = code(v);
    await needed(await this.tenants.get(c), c);
    const user = await UserModel.findOne({ _id: userId, companyCode: c });
    if (!user) throw new Error("Không tìm thấy người dùng trong doanh nghiệp này");
    if (user.role === "superadmin") throw new Error("Không thể chỉnh sửa tài khoản Superadmin");

    const update: any = {};
    if (input.displayName !== undefined) {
      const name = String(input.displayName).trim();
      if (!name) throw new Error("Họ và tên không được để trống");
      update.displayName = name;
    }
    if (input.email !== undefined) {
      const email = String(input.email).trim().toLowerCase();
      if (!email) throw new Error("Email không được để trống");
      if (email !== user.email) {
        const existing = await UserModel.findOne({ email, _id: { $ne: userId } });
        if (existing) throw new Error(`Email "${email}" đã được sử dụng`);
        update.email = email;
      }
    }
    if (input.role !== undefined) {
      const role = String(input.role).trim();
      if (!role) throw new Error("Vai trò không được để trống");
      update.role = role;
      if (role === "admin") update.level = 1;
      else if (role === "branch_owner") update.level = 2;
      else if (role === "manager") update.level = 3;
      else update.level = 4;
    }
    if (input.phone !== undefined) update.phone = String(input.phone).trim();
    if (input.department !== undefined) update.department = String(input.department).trim();
    if (input.jobTitle !== undefined) update.jobTitle = String(input.jobTitle).trim();
    if (input.disabledAt !== undefined) {
      update.disabledAt = input.disabledAt ? new Date(input.disabledAt) : null;
    }
    if (input.password !== undefined && String(input.password).trim() !== "") {
      const pw = String(input.password);
      if (pw.length < 6) throw new Error("Mật khẩu mới phải có ít nhất 6 ký tự");
      update.password = await bcrypt.hash(pw, 10);
    }

    const updatedUser = await UserModel.findByIdAndUpdate(userId, { $set: update }, { new: true }).select("-password").lean();
    return updatedUser;
  }

  async deleteUser(v: string, userId: string) {
    const c = code(v);
    await needed(await this.tenants.get(c), c);
    const user = await UserModel.findOne({ _id: userId, companyCode: c });
    if (!user) throw new Error("Không tìm thấy người dùng trong doanh nghiệp này");
    if (user.role === "superadmin") {
      throw new Error("Không thể xóa tài khoản Superadmin");
    }

    const parentId = user.parentId || null;
    let parentLevel = 1;
    if (parentId) {
      const parentUser = await UserModel.findById(parentId);
      parentLevel = parentUser?.level || 1;
    }
    const children = await UserModel.find({ parentId: userId });
    for (const child of children) {
      child.parentId = parentId || undefined;
      child.level = parentLevel + 1;
      await child.save();
    }

    await UserModel.findByIdAndDelete(userId);
    return { success: true };
  }
}
