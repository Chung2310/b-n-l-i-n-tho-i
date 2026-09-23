import { useAuth } from "../../../context/AuthContext";
import { useBranch } from "../../../context/BranchContext";

export function useRetailScope() {
  const { userProfile } = useAuth();
  const branchContext = useBranch();
  const activeBranchId = branchContext?.activeBranchId;
  const activeBranch = branchContext?.activeBranch || branchContext?.branches?.find((b) => b._id === activeBranchId);
  const branchName =
    activeBranch?.name ||
    (userProfile?.branchId === activeBranchId ? userProfile?.branchName : undefined) ||
    "";

  return {
    scope:
      userProfile?.companyCode && activeBranchId
        ? { companyCode: userProfile.companyCode, branchId: activeBranchId }
        : null,
    userProfile,
    activeBranch,
    branchName,
  };
}
