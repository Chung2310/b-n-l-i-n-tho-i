import { DepartmentModel } from "./department.model";

export async function migrateDepartmentBranchIndex() {
  // Build the narrower uniqueness constraint before removing the old one.
  await DepartmentModel.collection.createIndex({ companyCode: 1, branchId: 1, code: 1 }, { unique: true });
  const indexes = await DepartmentModel.collection.indexes();
  for (const index of indexes) {
    if (index.unique && index.name && Object.keys(index.key).length === 2 && index.key.companyCode === 1 && index.key.code === 1) {
      await DepartmentModel.collection.dropIndex(index.name);
    }
  }
}
