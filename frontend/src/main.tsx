import React from "react";
import { createRoot } from "react-dom/client";

import "./styles/app.css";
import type { AppBootstrap } from "@/types/app";
import { ThemeProvider } from "@/context/ThemeContext";
import { ToastProvider } from "@/context/ToastContext";
import ToastStack from "@/components/ui/ToastStack";
import AuthLoginPage from "@/pages/auth/AuthLoginPage";
import AuthRegisterPage from "@/pages/auth/AuthRegisterPage";
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/auth/ResetPasswordPage";
import VerifyCodePage from "@/pages/auth/VerifyCodePage";
import ErrorPage from "@/pages/errors/ErrorPage";
import UserHomePage from "@/pages/user/UserHomePage";
import ProfilePage from "@/pages/user/ProfilePage";
import SettingsPage from "@/pages/user/SettingsPage";
import LoginActivityPage from "@/pages/user/LoginActivityPage";
import NotificationsPage from "@/pages/user/NotificationsPage";
import MemberCardPage from "@/pages/user/MemberCardPage";
import GuestLandingPage from "@/pages/farmer/GuestLandingPage";
import FarmerDashboardPage from "@/pages/farmer/FarmerDashboardPage";
import FarmerChatPage from "@/pages/farmer/FarmerChatPage";
import FarmerResultPage from "@/pages/farmer/FarmerResultPage";
import FarmerDiagnoseClassicPage from "@/pages/farmer/FarmerDiagnoseClassicPage";
import FarmerHistoryPage from "@/pages/farmer/FarmerHistoryPage";
import FarmerNewsPage from "@/pages/farmer/FarmerNewsPage";
import FarmerDetailPage from "@/pages/farmer/FarmerDetailPage";
import FarmerUpgradePage from "@/pages/farmer/FarmerUpgradePage";
import FarmerCheckoutPage from "@/pages/farmer/FarmerCheckoutPage";
import FarmerDiseasesPage from "@/pages/farmer/FarmerDiseasesPage";
import DiagnosisWizardPage from "@/diagnosis/DiagnosisWizardPage";
import ExpertDashboardPage from "@/pages/expert/ExpertDashboardPage";
import ExpertPendingDiagnosesPage from "@/pages/expert/ExpertPendingDiagnosesPage";
import ExpertReviewDiagnosisPage from "@/pages/expert/ExpertReviewDiagnosisPage";
import ExpertFarmerChatsPage from "@/pages/expert/ExpertFarmerChatsPage";
import ExpertReplyChatPage from "@/pages/expert/ExpertReplyChatPage";
import ExpertSupportHubPage from "@/pages/expert/ExpertSupportHubPage";
import ExpertDiseasesPage from "@/pages/expert/ExpertDiseasesPage";
import ExpertDiseaseFormPage from "@/pages/expert/ExpertDiseaseFormPage";
import ExpertOptionalFormPage from "@/pages/expert/ExpertOptionalFormPage";
import ExpertKnowledgeDashboardPage from "@/pages/expert/ExpertKnowledgeDashboardPage";
import ExpertCreateSymptomPage from "@/pages/expert/ExpertCreateSymptomPage";
import ExpertCreateRulePage from "@/pages/expert/ExpertCreateRulePage";
import ExpertMixedAgriDashboardPage from "@/pages/expert/ExpertMixedAgriDashboardPage";
import ExpertMixedAgriSourcesPage from "@/pages/expert/ExpertMixedAgriSourcesPage";
import ExpertMixedAgriSourceFormPage from "@/pages/expert/ExpertMixedAgriSourceFormPage";
import ExpertMixedAgriFactsPage from "@/pages/expert/ExpertMixedAgriFactsPage";
import ExpertMixedAgriFactFormPage from "@/pages/expert/ExpertMixedAgriFactFormPage";
import AdminDashboardPage from "@/pages/admin/AdminDashboardPage";
import AdminWorldPage from "@/pages/admin/AdminWorldPage";
import AdminExpertStatsPage from "@/pages/admin/AdminExpertStatsPage";
import AdminAuditLogsPage from "@/pages/admin/AdminAuditLogsPage";
import AdminUsersPage from "@/pages/admin/AdminUsersPage";
import AdminUserDetailPage from "@/pages/admin/AdminUserDetailPage";
import AdminRolesPage from "@/pages/admin/AdminRolesPage";
import AdminRolePermissionsPage from "@/pages/admin/AdminRolePermissionsPage";
import AdminCropsPage from "@/pages/admin/AdminCropsPage";
import AdminCropFormPage from "@/pages/admin/AdminCropFormPage";
import AdminDiseasesPage from "@/pages/admin/AdminDiseasesPage";
import AdminDiseaseFormPage from "@/pages/admin/AdminDiseaseFormPage";
import AdminMarqueesPage from "@/pages/admin/AdminMarqueesPage";
import AdminMarqueeFormPage from "@/pages/admin/AdminMarqueeFormPage";
import AdminPromoCodesPage from "@/pages/admin/AdminPromoCodesPage";
import AdminSupportRequestsPage from "@/pages/admin/AdminSupportRequestsPage";
import AdminSupportChatsPage from "@/pages/admin/AdminSupportChatsPage";
import AdminPremiumSettingsPage from "@/pages/admin/AdminPremiumSettingsPage";
import AdminTranslationsPage from "@/pages/admin/AdminTranslationsPage";
import AdminTranslationsBackupsPage from "@/pages/admin/AdminTranslationsBackupsPage";
import AdminSettingsPage from "@/pages/admin/AdminSettingsPage";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { buildNavSections } from "@/lib/navigation";

function readAppBootstrap(): AppBootstrap | null {
  const inline = (window as unknown as { __APP_BOOTSTRAP__?: AppBootstrap }).__APP_BOOTSTRAP__;
  if (inline && typeof inline === "object") {
    return inline;
  }
  const node = document.getElementById("app-bootstrap");
  if (!node) return null;
  try {
    return JSON.parse(node.textContent || "{}") as AppBootstrap;
  } catch {
    return null;
  }
}

function PageRouter({ bootstrap }: { bootstrap: AppBootstrap }) {
  const pageId = bootstrap.page?.id;

  switch (pageId) {
    case "auth-login":
    case "staff-login":
      return <AuthLoginPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "auth-register":
      return <AuthRegisterPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "auth-forgot-password":
      return <ForgotPasswordPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "auth-reset-password":
      return <ResetPasswordPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "auth-verify-code":
      return <VerifyCodePage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "error-page":
      return <ErrorPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "user-home":
      return <UserHomePage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "user-profile":
      return <ProfilePage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "user-settings":
      return <SettingsPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "user-login-activity":
      return <LoginActivityPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "user-notifications":
      return <NotificationsPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "user-member-card":
      return <MemberCardPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "farmer-guest-landing":
      return <GuestLandingPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "farmer-dashboard":
      return <FarmerDashboardPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "farmer-chat":
      return <FarmerChatPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "farmer-result":
      return <FarmerResultPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "farmer-diagnose-classic":
      return <FarmerDiagnoseClassicPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "farmer-diagnose-wizard":
      return (
        <WorkspaceShell
          bootstrap={bootstrap}
          navSections={buildNavSections(bootstrap)}
          pageTitle={bootstrap.ui.pageTitle}
          pageSubtitle={bootstrap.ui.pageSubtitle}
        >
          <DiagnosisWizardPage bootstrap={bootstrap.data} />
        </WorkspaceShell>
      );
    case "farmer-history":
      return <FarmerHistoryPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "farmer-news":
      return <FarmerNewsPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "farmer-detail":
      return <FarmerDetailPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "farmer-upgrade":
      return <FarmerUpgradePage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "farmer-checkout":
      return <FarmerCheckoutPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "farmer-diseases":
      return <FarmerDiseasesPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "expert-dashboard":
      return <ExpertDashboardPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "expert-pending-diagnoses":
      return <ExpertPendingDiagnosesPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "expert-review-diagnosis":
      return <ExpertReviewDiagnosisPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "expert-farmer-chats":
      return <ExpertFarmerChatsPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "expert-reply-chat":
      return <ExpertReplyChatPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "expert-support-hub":
      return <ExpertSupportHubPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "expert-diseases":
      return <ExpertDiseasesPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "expert-disease-form":
      return <ExpertDiseaseFormPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "expert-knowledge-input":
      return <ExpertOptionalFormPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "expert-knowledge-dashboard":
      return <ExpertKnowledgeDashboardPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "expert-create-symptom":
      return <ExpertCreateSymptomPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "expert-create-rule":
      return <ExpertCreateRulePage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "expert-mixed-agri-dashboard":
      return <ExpertMixedAgriDashboardPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "expert-mixed-agri-sources":
      return <ExpertMixedAgriSourcesPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "expert-mixed-agri-source-form":
      return <ExpertMixedAgriSourceFormPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "expert-mixed-agri-facts":
      return <ExpertMixedAgriFactsPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "expert-mixed-agri-fact-form":
      return <ExpertMixedAgriFactFormPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "admin-dashboard":
      return <AdminDashboardPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "admin-world":
      return <AdminWorldPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "admin-expert-stats":
      return <AdminExpertStatsPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "admin-audit-logs":
      return <AdminAuditLogsPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "admin-users":
      return <AdminUsersPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "admin-user-detail":
      return <AdminUserDetailPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "admin-roles":
      return <AdminRolesPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "admin-role-permissions":
      return <AdminRolePermissionsPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "admin-crops":
      return <AdminCropsPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "admin-crop-form":
      return <AdminCropFormPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "admin-diseases":
      return <AdminDiseasesPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "admin-disease-form":
      return <AdminDiseaseFormPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "admin-marquees":
      return <AdminMarqueesPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "admin-marquee-form":
      return <AdminMarqueeFormPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "admin-promo-codes":
      return <AdminPromoCodesPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "admin-support-requests":
      return <AdminSupportRequestsPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "admin-support-chats":
      return <AdminSupportChatsPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "admin-premium-settings":
      return <AdminPremiumSettingsPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "admin-translations":
      return <AdminTranslationsPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "admin-translations-backups":
      return <AdminTranslationsBackupsPage bootstrap={bootstrap as AppBootstrap<any>} />;
    case "admin-settings":
      return <AdminSettingsPage bootstrap={bootstrap as AppBootstrap<any>} />;
    default:
      return (
        <div className="flex min-h-screen items-center justify-center p-6 text-center text-sm text-slate-500">
          Unknown page route: <code>{String(pageId || "none")}</code>
        </div>
      );
  }
}

function AppRoot({ bootstrap }: { bootstrap: AppBootstrap }) {
  return (
    <ThemeProvider initialTheme={bootstrap.settings?.theme || "system"}>
      <ToastProvider initialFlashes={bootstrap.flashes || []}>
        <ToastStack />
        <PageRouter bootstrap={bootstrap} />
      </ToastProvider>
    </ThemeProvider>
  );
}

const rootEl = document.getElementById("react-template-root");
const bootstrap = readAppBootstrap();

if (rootEl && bootstrap) {
  createRoot(rootEl).render(
    <React.StrictMode>
      <AppRoot bootstrap={bootstrap} />
    </React.StrictMode>,
  );
}
