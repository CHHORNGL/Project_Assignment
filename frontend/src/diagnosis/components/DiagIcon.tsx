import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bot,
  Camera,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CloudUpload,
  HelpCircle,
  Image as ImageIcon,
  Info,
  Leaf,
  List,
  Loader2,
  Microscope,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Sprout,
  Stethoscope,
  StopCircle,
  Upload,
  Video,
  VideoOff,
  X,
  XCircle,
  type LucideProps,
} from "lucide-react";
import type { ComponentType } from "react";

const ICON_MAP: Record<string, ComponentType<LucideProps>> = {
  "fa-arrow-left": ArrowLeft,
  "fa-arrow-right": ArrowRight,
  "fa-camera": Camera,
  "fa-check": Check,
  "fa-check-circle": CheckCircle2,
  "fa-check-double": CheckCheck,
  "fa-chevron-left": ChevronLeft,
  "fa-chevron-right": ChevronRight,
  "fa-circle-notch": Loader2,
  "fa-cloud-upload-alt": CloudUpload,
  "fa-exclamation-circle": AlertCircle,
  "fa-exclamation-triangle": AlertTriangle,
  "fa-image": ImageIcon,
  "fa-info-circle": Info,
  "fa-leaf": Leaf,
  "fa-list": List,
  "fa-magic": Sparkles,
  "fa-microscope": Microscope,
  "fa-notes-medical": ClipboardList,
  "fa-plus": Plus,
  "fa-question-circle": HelpCircle,
  "fa-robot": Bot,
  "fa-search": Search,
  "fa-seedling": Sprout,
  "fa-signal": Activity,
  "fa-spinner": Loader2,
  "fa-stethoscope": Stethoscope,
  "fa-stop-circle": StopCircle,
  "fa-sync-alt": RefreshCw,
  "fa-times": X,
  "fa-times-circle": XCircle,
  "fa-upload": Upload,
  "fa-user-md": Stethoscope,
  "fa-video": Video,
  "fa-video-slash": VideoOff,
};

export function DiagIcon({
  name,
  className = "h-4 w-4",
}: {
  name: string;
  className?: string;
}) {
  const cleanKey =
    name
      .split(/\s+/)
      .find((tok) => tok.startsWith("fa-") && tok !== "fa-fw") || name;
  const Icon = ICON_MAP[cleanKey] || Info;
  return <Icon className={className} aria-hidden="true" />;
}
