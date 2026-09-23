// @vitest-environment jsdom
import React from "react";
import {it,expect,vi,afterEach} from "vitest";
import {render,screen,fireEvent,cleanup} from "@testing-library/react";
import DebtManagementPanel from "./DebtManagementPanel";
import {financeManagement} from "../api/financeManagement.api";
vi.mock("../api/financeManagement.api",()=>({financeManagement:vi.fn()}));
afterEach(cleanup);
it.each(["aging","reminders","debt"] as const)("settled supplier debt stays only in history (%s)",async mode=>{
 vi.mocked(financeManagement).mockResolvedValue({receivables:[],unregisteredReceipts:[],payables:[{_id:"paid",supplierId:"S",supplierName:"Supplier paid",balance:0,originalAmount:100,paidAmount:100,daysUntil:-5,aging:"1-7",dueDate:"2026-09-01"}]});
 render(<DebtManagementPanel mode={mode} permissions={["*"]} onOpen={()=>{}}/>);
 await screen.findByText(/Số dư công nợ hiện tại/);
 fireEvent.click(screen.getByText("Phải trả nhà cung cấp"));
 expect(Boolean(screen.queryByText("Supplier paid"))).toBe(mode==="debt");
});
