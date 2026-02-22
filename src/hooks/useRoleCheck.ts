const { isAdmin, canAccess } = useRoleCheck();

if (!isAdmin()) {
  toast.error("Admin only");
  return;
}
