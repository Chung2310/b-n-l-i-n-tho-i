/** Employee commissions from the retired labor module are no longer included in payroll. */
export async function getApprovedEmployeeCommissions(_input: { companyCode: string; branchId: string; periodKey: string }): Promise<Map<string, number>> {
  return new Map();
}