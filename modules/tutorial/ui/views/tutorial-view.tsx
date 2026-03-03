"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    BarChart3,
    Bell,
    BookOpen,
    BrainCircuit,
    Check,
    CheckCircle2,
    ChevronDown,
    ClipboardList,
    GraduationCap,
    Home,
    Info,
    Lightbulb,
    Package,
    Settings,
    ShoppingBag,
    Sparkles,
    TrendingUp,
    UserCog,
    Users,
    Wheat
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

// ─── Types ───────────────────────────────────────────────
interface Step {
    title: string;
    description: string;
}

interface TipItem {
    text: string;
    type: "tip" | "info" | "warning";
}

interface TutorialSection {
    id: string;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    color: string;
    href?: string;
    steps: Step[];
    tips?: TipItem[];
}

// ─── Tutorial Data ───────────────────────────────────────
const TUTORIAL_SECTIONS: TutorialSection[] = [
    {
        id: "getting-started",
        title: "Getting Started",
        subtitle: "Set up your account and navigate the app",
        icon: <GraduationCap className="size-5" />,
        color: "from-emerald-500 to-teal-500",
        steps: [
            {
                title: "Sign In",
                description:
                    "Create an account or sign in with your credentials. You can use Google sign-in for quick access.",
            },
            {
                title: "Join an Organization",
                description:
                    'After signing in, you\'ll need an organization (farm). The farm owner will invite you, or you can create your own if you have the "ADMIN" global role.',
            },
            {
                title: "Navigate the Sidebar",
                description:
                    "Use the sidebar menu (tap the hamburger icon on mobile) to access all app features: Dashboard, Cycles, Farmers, Sales, Orders, and Reports.",
            },
            {
                title: "Switch Modes",
                description:
                    'If you are an Owner or Manager, you can switch between "Officer" and "Management" modes using the toggle at the top of the sidebar.',
            },
            {
                title: "Update Your Profile",
                description:
                    'Tap your avatar in the sidebar footer to access profile settings. You can update your display name, branch name, and mobile number.',
            },
            {
                title: "Push Notifications",
                description:
                    'The app registers for push notifications automatically. You will receive alerts for important events like membership approvals, stock warnings, and more.',
            },
        ],
        tips: [
            {
                text: "Swipe right from the left edge on mobile to quickly open the sidebar.",
                type: "tip",
            },
        ],
    },
    {
        id: "dashboard",
        title: "Dashboard",
        subtitle: "Your overview of daily operations and KPIs",
        icon: <Home className="size-5" />,
        color: "from-blue-500 to-indigo-500",
        href: "/",
        steps: [
            {
                title: "KPI Cards",
                description:
                    "At the top you'll see key performance indicators: total farmers under you, active cycles running, and today's feed consumption. These update in real-time.",
            },
            {
                title: "Operations Tab",
                description:
                    "The main area shows all your active cycles with their current day, remaining birds, and today's feed intake. Tap on any cycle card to go directly to its detail page.",
            },
            {
                title: "Performance Insights",
                description:
                    "Scroll down to see performance comparisons across your cycles — best FCR, highest survival rate, and top-performing batches.",
            },
            {
                title: "Quick Details",
                description:
                    "The Quick Details section shows a snapshot of your farmer assignments and recent activity for quick reference.",
            },
        ],
    },
    {
        id: "farmers",
        title: "Farmers",
        subtitle: "Manage your farmer assignments and stock",
        icon: <Wheat className="size-5" />,
        color: "from-amber-500 to-orange-500",
        href: "/farmers",
        steps: [
            {
                title: "Add a Farmer",
                description:
                    'Tap the "+" button to register a new farmer. You must provide their name and initial main stock (feed bags). Optionally add their location and mobile number.',
            },
            {
                title: "View Farmer List",
                description:
                    "Your farmer list shows each farmer's name, main stock remaining, total consumed, and active cycle status. Use the search bar to quickly find farmers.",
            },
            {
                title: "Edit Farmer Details",
                description:
                    "Tap on a farmer's card to see more options. You can edit their name, location, and mobile number at any time.",
            },
            {
                title: "Manage Main Stock",
                description:
                    'Use the stock icon on a farmer\'s card to add (restock) or deduct feed bags from their main stock. Every change is logged in the Stock Ledger.',
            },
            {
                title: "Security Money",
                description:
                    "Track security deposits for each farmer. Changes are logged with the previous and new amounts for full audit trail.",
            },
            {
                title: "Security Money History",
                description:
                    'View the full history of security money changes for a farmer — every increase, decrease, and the officer who made the change, with timestamps.',
            },
            {
                title: "Problematic Feed",
                description:
                    'Mark feed bags as "problematic" (damaged, expired, etc.). This is tracked separately and shown in reports.',
            },
            {
                title: "Delete / Soft-Delete",
                description:
                    'Deleting a farmer soft-deletes them (status changes to "deleted"). Their cycles and history are preserved for reporting purposes.',
            },
            {
                title: "Benchmark Stats",
                description:
                    'Pro users can view benchmark statistics for a farmer — average FCR, EPI, survival rate, and average weight across all their past cycles. Great for comparing farmer performance.',
            },
            {
                title: "Restore Deleted Farmer",
                description:
                    'Accidentally deleted a farmer? Open the "Archived" tab to find soft-deleted farmers and restore them back to active status with all their history intact.',
            },
        ],
        tips: [
            {
                text: "Farmer names must be unique per officer within the same organization.",
                type: "info",
            },
            {
                text: "You can only manage farmers that you created. Other officers' farmers are not visible to you.",
                type: "warning",
            },
        ],
    },
    {
        id: "cycles",
        title: "Cycles",
        subtitle: "Track active bird batches from start to finish",
        icon: <Users className="size-5" />,
        color: "from-violet-500 to-purple-500",
        href: "/cycles",
        steps: [
            {
                title: "Create a Cycle",
                description:
                    'Tap "Add Cycle" and select a farmer. Enter the batch name (e.g., "Batch-2024-A"), the Day Old Chicks (DOC) count, and optionally the bird type.',
            },
            {
                title: "Daily Feed Logging",
                description:
                    "Each day, log the feed consumed for each cycle. Tap the feed icon on the cycle card, enter the number of bags, and confirm. This increments the cycle's total intake and decrements the farmer's main stock.",
            },
            {
                title: "Mortality Tracking",
                description:
                    "Record daily bird deaths by tapping the mortality icon. Enter the count and an optional note. The system automatically updates the remaining bird count.",
            },
            {
                title: "Age Tracking",
                description:
                    "The cycle's age (in days) can be manually updated. This is used in performance metric calculations like FCR and EPI.",
            },
            {
                title: "Corrections",
                description:
                    'Made a mistake? Use the "Correction" feature to adjust feed intake or mortality figures. Corrections are logged separately for transparency.',
            },
            {
                title: "Correct DOC / Age / Mortality",
                description:
                    'Pro users can correct the initial DOC count, bird age, or total mortality on active cycles. Each correction creates a log entry with old and new values for audit purposes.',
            },
            {
                title: "Revert a Log Entry",
                description:
                    'Made a feed or mortality entry by mistake? Use "Revert" on any log entry to undo it. The system automatically rolls back the stock and bird counts.',
            },
            {
                title: "Backdate a Cycle",
                description:
                    'Need to register a cycle that started earlier? Pro users can backdate a cycle\'s creation date. This adjusts the age calculation retroactively.',
            },
            {
                title: "Restore / Reopen a Cycle",
                description:
                    'Closed a cycle too early? Use "Restore" from Cycle History to reopen it as an active cycle, retaining all previous logs and data.',
            },
            {
                title: "Bulk Create Cycles",
                description:
                    'Pro users can create multiple cycles at once from the AI-parsed DOC order data. Each cycle is auto-linked to the matched farmer.',
            },
            {
                title: "Delete Cycle History",
                description:
                    'Remove a closed cycle\'s history record permanently. This is useful for cleaning up test or erroneous entries.',
            },
            {
                title: "View Cycle Logs",
                description:
                    "Tap on a cycle to see its complete log history — every feed entry, mortality record, and correction, with timestamps and who made each entry.",
            },
            {
                title: "Close / Archive a Cycle",
                description:
                    'When a batch is complete, close the cycle. It moves to "Cycle History" with a snapshot of all final stats (DOC, mortality, intake, age). Logs are preserved.',
            },
            {
                title: "Edit Age (During Sale)",
                description:
                    'When recording a sale, you can edit the cycle\'s age directly from the sale modal if it\'s not accurate. This ensures the FCR, EPI and other metrics are calculated correctly.',
            },
            {
                title: "FCR & EPI Details",
                description:
                    'Tap the FCR or EPI value on a cycle card to open a detailed breakdown showing the formula, each input value, and how the metric was calculated.',
            },
            {
                title: "Profit Details",
                description:
                    'After a sale report is generated, tap the profit figure to see a full breakdown: revenue, DOC cost, feed cost, medicine, transport, and net profit per bird.',
            },
        ],
        tips: [
            {
                text: "Feed logging automatically updates the farmer's main stock — you don't need to manually deduct it.",
                type: "tip",
            },
            {
                text: "Each farmer can have multiple active cycles running simultaneously.",
                type: "info",
            },
            {
                text: "Corrections (DOC, Age, Mortality) and Backdate are Pro features. Revert and basic editing are free.",
                type: "info",
            },
        ],
    },
    {
        id: "sales",
        title: "Sales",
        subtitle: "Record bird sales and generate financial reports",
        icon: <ShoppingBag className="size-5" />,
        color: "from-pink-500 to-rose-500",
        href: "/sales",
        steps: [
            {
                title: "Record a Sale",
                description:
                    'From a cycle\'s detail page, tap "Record Sale". Enter the birds sold, total weight, price per kg, and payment details (cash received, deposits).',
            },
            {
                title: "Feed Consumed & Stock",
                description:
                    "During a sale, you also record the feed consumed and current feed stock as JSON arrays broken down by feed type (e.g., B1, B2).",
            },
            {
                title: "Generate Sale Reports",
                description:
                    "After recording a sale event, you can generate detailed financial reports that include FCR, EPI, survival rate, DOC cost, feed cost, revenue, and net profit.",
            },
            {
                title: "Adjust Reports",
                description:
                    "Need to make adjustments? Create additional reports for the same sale event with different pricing or quantities. Select the most accurate report as the primary.",
            },
            {
                title: "Adjust Sale Event",
                description:
                    'After creating a sale event, you can adjust its details — modify birds sold, total weight, feed consumed/stock arrays, price per kg, and payment info without deleting and recreating.',
            },
            {
                title: "View Sales History",
                description:
                    'The Sales page shows all recent sales grouped by farmer. Each entry shows birds sold, total weight, average weight, and total amount.',
            },
            {
                title: "Preview Sale",
                description:
                    'Before finalizing, use "Preview Sale" to see estimated metrics (FCR, EPI, profit) based on current cycle data and proposed sale details.',
            },
            {
                title: "Set Active Report Version",
                description:
                    'If multiple reports exist for one sale event, mark the most accurate one as "Active". Only the active version is used in official reports and analytics.',
            },
            {
                title: "Delete a Sale Event",
                description:
                    'Delete an erroneous sale event and all its associated reports. This reverses the birds-sold count on the cycle.',
            },
        ],
        tips: [
            {
                text: "Sales is a Pro feature. Upgrade to access detailed financial reporting and sale management.",
                type: "info",
            },
        ],
    },
    {
        id: "stock-ledger",
        title: "Stock Ledger & Import History",
        subtitle: "Full audit trail of all feed stock changes",
        icon: <ClipboardList className="size-5" />,
        color: "from-cyan-500 to-sky-500",
        href: "/stock-ledger",
        steps: [
            {
                title: "View All Stock Logs",
                description:
                    'The Stock Ledger shows every stock change across all your farmers — restocks, cycle feed consumption, corrections, and initial stock entries. Each entry shows the type, amount, and timestamp.',
            },
            {
                title: "Search & Filter",
                description:
                    "Search by farmer name or use the search bar to quickly find specific stock movements.",
            },
            {
                title: "Import History",
                description:
                    "If bulk imports have been done, they appear here with the driver name and reference details for full traceability.",
            },
            {
                title: "Revert a Stock Transaction",
                description:
                    'Made a restock or deduction error? Use the revert button on any stock log entry to undo it. The farmer\'s main stock is automatically corrected.',
            },
            {
                title: "Transfer Stock Between Farmers",
                description:
                    'Transfer feed bags from one farmer to another without affecting the total organizational stock. Both transfers are logged in the Stock Ledger.',
            },
            {
                title: "Bulk Feed Import",
                description:
                    'Pro users can add stock to multiple farmers in one step using the AI Smart Feed Import. Paste a text list of farmer names and bag counts — the system matches and applies all restocks in one transaction with a driver name tag.',
            },
            {
                title: "Batch Details",
                description:
                    'View all individual stock entries within a specific bulk import batch. Each entry shows the farmer, amount, and any notes.',
            },
            {
                title: "All Farmers Stock Overview",
                description:
                    'Pro users can view a consolidated stock overview for ALL active farmers at a glance — main stock, consumed, and available balance for each.',
            },
        ],
        tips: [
            {
                text: "Bulk Import and All Farmers Stock overview are Pro features.",
                type: "info",
            },
        ],
    },
    {
        id: "orders",
        title: "Orders",
        subtitle: "Create and manage feed, DOC, and sale orders",
        icon: <Package className="size-5" />,
        color: "from-lime-500 to-green-500",
        steps: [
            {
                title: "Feed Orders",
                description:
                    'Go to Orders → Feed Orders. Create an order by selecting a delivery date, adding farmers and their required feed types (B1, B2, etc.) with quantities. Share the order as a formatted message.',
            },
            {
                title: "DOC Orders",
                description:
                    "Orders → DOC Orders lets you plan Day Old Chick orders. Specify the bird type, count, and whether it's a contract placement for each farmer.",
            },
            {
                title: "Sale Orders",
                description:
                    "Orders → Sale Orders helps you plan upcoming bird sales. Enter total weight, DOC count, average weight range, and bird age per farmer for the planned sale date.",
            },
            {
                title: "Confirm Orders",
                description:
                    'Orders start as "PENDING". Once confirmed with the supplier/buyer, mark them as "CONFIRMED" to update the status.',
            },
            {
                title: "Share Orders",
                description:
                    "Each order can be shared as a formatted text message — perfect for sending to suppliers, drivers, or managers via WhatsApp or SMS.",
            },
        ],
        tips: [
            {
                text: "All order types are Pro features. Upgrade to unlock order management.",
                type: "info",
            },
        ],
    },
    {
        id: "ai-features",
        title: "AI-Powered Features",
        subtitle: "Smart automation for feed imports, orders, and risk alerts",
        icon: <BrainCircuit className="size-5" />,
        color: "from-indigo-500 to-violet-600",
        steps: [
            {
                title: "Smart Feed Import",
                description:
                    'Paste a text message (e.g., from WhatsApp) containing farmer names and feed bag counts. The AI automatically extracts and matches farmer names to your existing list, even with spelling variations.',
            },
            {
                title: "Smart DOC Order Parsing",
                description:
                    'Paste a raw DOC order text and the AI will extract each farmer\'s name, bird count, bird type, and order date. Matched farmers are auto-linked to your existing records.',
            },
            {
                title: "Smart Watchdog",
                description:
                    'The risk assessment tool scans all active cycles for abnormal mortality spikes in the last 3 days. It flags "CRITICAL" (>1% mortality) and "WARNING" (>0.5%) conditions with farmer-specific alerts.',
            },
            {
                title: "Supply Chain Prediction",
                description:
                    'Predicts upcoming feed stockouts by calculating each farmer\'s daily burn rate (from recent feed logs or estimated from bird age). Farmers with <3 bags remaining or <4 days of supply are flagged as CRITICAL or HIGH urgency.',
            },
        ],
        tips: [
            {
                text: "AI features are Pro-only. The Smart Watchdog and Supply Chain tools are available from the Dashboard.",
                type: "info",
            },
            {
                text: "The AI uses multiple fallback models — if one is unavailable, it automatically tries the next.",
                type: "tip",
            },
        ],
    },
    {
        id: "notifications",
        title: "Notifications",
        subtitle: "Stay informed with in-app and push alerts",
        icon: <Bell className="size-5" />,
        color: "from-orange-500 to-red-500",
        steps: [
            {
                title: "View Notifications",
                description:
                    'Tap the bell icon in the navbar to see your notification list. Notifications include membership approvals, stock alerts, and system announcements.',
            },
            {
                title: "Unread Count Badge",
                description:
                    'A red badge on the bell icon shows how many unread notifications you have. This updates in real-time.',
            },
            {
                title: "Mark as Read",
                description:
                    'Tap a notification to mark it as read, or use "Mark All as Read" to clear all unread notifications at once.',
            },
            {
                title: "Delete Notifications",
                description:
                    'Swipe or tap the delete button on individual notifications to remove them permanently.',
            },
        ],
    },
    {
        id: "profile-settings",
        title: "Profile & Settings",
        subtitle: "Manage your account, security, and preferences",
        icon: <Settings className="size-5" />,
        color: "from-gray-500 to-slate-600",
        href: "/settings/security",
        steps: [
            {
                title: "Edit Profile",
                description:
                    'Update your display name, branch name, and mobile number from your profile. These details appear in reports and are visible to managers.',
            },
            {
                title: "Change Password",
                description:
                    'If you signed up with email/password, go to Settings → Security to change your password. This option only appears if your account has a password set.',
            },
            {
                title: "Request Pro Access",
                description:
                    'Need Pro features? Tap the "Upgrade" or "Request Access" button. Your request goes to the admin for approval. Track your request status in real-time.',
            },
            {
                title: "Theme Toggle",
                description:
                    'Switch between light and dark mode using the theme toggle in the sidebar header. Your preference is saved automatically.',
            },
        ],
        tips: [
            {
                text: "Pro features include Sales, all Order types, Stock Ledger, Reports, and AI tools.",
                type: "info",
            },
        ],
    },
    {
        id: "reports",
        title: "Reports",
        subtitle: "Performance analytics and production tracking",
        icon: <BarChart3 className="size-5" />,
        color: "from-fuchsia-500 to-pink-500",
        steps: [
            {
                title: "Performance Report",
                description:
                    "View aggregated performance metrics across all your cycles — FCR. EPI, survival rate, and average bird weight. Compare batches side by side.",
            },
            {
                title: "Monthly Production",
                description:
                    "Track month-by-month production volumes including total birds placed, sold, and mortality rates across all your farmers.",
            },
            {
                title: "DOC Placements",
                description:
                    "See a monthly breakdown of Day Old Chick placements by farmer, bird type, and contract status. Great for planning and tracking growth.",
            },
            {
                title: "Download Reports",
                description:
                    "Download individual or all reports for offline use or sharing with management. Reports are generated as formatted documents.",
            },
        ],
        tips: [
            {
                text: "Reports are Pro features. All reports are based on your recorded data — keep your daily logs accurate for best results.",
                type: "tip",
            },
        ],
    },
    {
        id: "management",
        title: "Management Mode",
        subtitle: "Owner/Manager tools for cross-officer oversight",
        icon: <UserCog className="size-5" />,
        color: "from-slate-500 to-zinc-600",
        href: "/management",
        steps: [
            {
                title: "Switch to Management Mode",
                description:
                    'If you\'re an Owner or Manager, use the mode toggle at the top of the sidebar to switch to "Management" view. The sidebar changes color to indicate you\'re in management mode.',
            },
            {
                title: "Officers Overview",
                description:
                    "View all officers in your organization, their status (active/pending), and role. Approve or reject pending membership requests.",
            },
            {
                title: "Cross-Officer Farmers & Cycles",
                description:
                    "In management mode, you can see ALL farmers and cycles across all officers — not just your own. Great for getting the full organizational picture.",
            },
            {
                title: "Feed Orders (Management)",
                description:
                    "View feed orders from all officers in your organization. Coordinate deliveries and track order statuses across the team.",
            },
            {
                title: "Management Reports",
                description:
                    "Access Sales & Stock reports, Performance analytics, DOC Placements, and Monthly Production across all officers for organization-wide insights.",
            },
        ],
        tips: [
            {
                text: "Management features are only available to users with Owner or Manager roles in the organization.",
                type: "info",
            },
            {
                text: 'Managers with "VIEW" access can see everything but can\'t edit. "EDIT" access allows full management capabilities.',
                type: "warning",
            },
        ],
    },
];

const STORAGE_KEY = "feed-reminder-tutorial-progress";

// ─── Component ───────────────────────────────────────────
export function TutorialView() {
    const [completedSections, setCompletedSections] = useState<string[]>([]);
    const [expandedSection, setExpandedSection] = useState<string | null>("getting-started");

    // Load progress from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) setCompletedSections(JSON.parse(saved));
        } catch { }
    }, []);

    // Save progress to localStorage
    const saveProgress = useCallback((sections: string[]) => {
        setCompletedSections(sections);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(sections));
        } catch { }
    }, []);

    const toggleSection = (id: string) => {
        setExpandedSection((prev) => (prev === id ? null : id));
    };

    const toggleCompleted = (id: string) => {
        const next = completedSections.includes(id)
            ? completedSections.filter((s) => s !== id)
            : [...completedSections, id];
        saveProgress(next);
    };

    const progress = Math.round(
        (completedSections.length / TUTORIAL_SECTIONS.length) * 100
    );

    return (
        <div className="flex flex-col min-h-screen bg-muted/5">
            <div className="flex-1 p-3 sm:p-6 space-y-6 max-w-3xl mx-auto w-full">
                {/* Hero */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-border/50 p-6 sm:p-8">
                    <div className="absolute -top-12 -right-12 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
                    <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-primary/10 rounded-full blur-2xl" />

                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shadow-sm">
                                <BookOpen className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                                    App Tutorial
                                </h1>
                                <p className="text-sm text-muted-foreground">
                                    Learn every feature step by step
                                </p>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-5">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-muted-foreground">
                                    Progress
                                </span>
                                <span className="text-xs font-bold text-primary">
                                    {completedSections.length}/{TUTORIAL_SECTIONS.length} sections
                                </span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-500 ease-out"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sections */}
                <div className="space-y-3">
                    {TUTORIAL_SECTIONS.map((section, sectionIndex) => {
                        const isExpanded = expandedSection === section.id;
                        const isCompleted = completedSections.includes(section.id);

                        return (
                            <div
                                key={section.id}
                                className={`rounded-xl border transition-all duration-300 ${isExpanded
                                    ? "border-border shadow-lg shadow-black/5"
                                    : "border-border/50 hover:border-border/80"
                                    } ${isCompleted ? "bg-muted/30" : "bg-background"}`}
                            >
                                {/* Section Header */}
                                <button
                                    onClick={() => toggleSection(section.id)}
                                    className="w-full flex items-center gap-3 p-4 text-left group"
                                >
                                    <div
                                        className={`shrink-0 h-10 w-10 rounded-lg bg-gradient-to-br ${section.color} flex items-center justify-center text-white shadow-sm transition-transform duration-200 ${isExpanded ? "scale-110" : "group-hover:scale-105"
                                            }`}
                                    >
                                        {isCompleted ? (
                                            <Check className="size-5" />
                                        ) : (
                                            section.icon
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-sm font-semibold tracking-tight truncate">
                                                {section.title}
                                            </h2>
                                            {isCompleted && (
                                                <Badge
                                                    variant="secondary"
                                                    className="text-[10px] font-bold px-1.5 py-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                                >
                                                    Done
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground truncate">
                                            {section.subtitle}
                                        </p>
                                    </div>

                                    <ChevronDown
                                        className={`shrink-0 size-4 text-muted-foreground transition-transform duration-300 ${isExpanded ? "rotate-180" : ""
                                            }`}
                                    />
                                </button>

                                {/* Section Content */}
                                {isExpanded && (
                                    <div className="px-4 pb-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <Separator className="opacity-30" />

                                        {/* Steps */}
                                        <div className="space-y-3">
                                            {section.steps.map((step, stepIndex) => (
                                                <div
                                                    key={stepIndex}
                                                    className="flex gap-3 group/step"
                                                >
                                                    {/* Step Number */}
                                                    <div className="shrink-0 mt-0.5">
                                                        <div
                                                            className={`h-7 w-7 rounded-full bg-gradient-to-br ${section.color} flex items-center justify-center text-white text-xs font-bold shadow-sm`}
                                                        >
                                                            {stepIndex + 1}
                                                        </div>
                                                    </div>

                                                    {/* Step Content */}
                                                    <div className="flex-1 min-w-0 pb-3">
                                                        <h3 className="text-sm font-semibold leading-none mb-1.5">
                                                            {step.title}
                                                        </h3>
                                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                                            {step.description}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Tips */}
                                        {section.tips && section.tips.length > 0 && (
                                            <div className="space-y-2 pt-1">
                                                {section.tips.map((tip, tipIndex) => (
                                                    <div
                                                        key={tipIndex}
                                                        className={`flex items-start gap-2 p-3 rounded-lg text-xs leading-relaxed ${tip.type === "tip"
                                                            ? "bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 border border-emerald-500/10"
                                                            : tip.type === "warning"
                                                                ? "bg-amber-500/5 text-amber-700 dark:text-amber-400 border border-amber-500/10"
                                                                : "bg-blue-500/5 text-blue-700 dark:text-blue-400 border border-blue-500/10"
                                                            }`}
                                                    >
                                                        {tip.type === "tip" ? (
                                                            <Lightbulb className="size-3.5 shrink-0 mt-0.5" />
                                                        ) : tip.type === "warning" ? (
                                                            <Info className="size-3.5 shrink-0 mt-0.5" />
                                                        ) : (
                                                            <Sparkles className="size-3.5 shrink-0 mt-0.5" />
                                                        )}
                                                        <span>{tip.text}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Footer Actions */}
                                        <div className="flex items-center justify-between pt-2">
                                            <Button
                                                variant={isCompleted ? "outline" : "default"}
                                                size="sm"
                                                onClick={() => toggleCompleted(section.id)}
                                                className={`text-xs gap-1.5 ${isCompleted
                                                    ? "text-muted-foreground"
                                                    : ""
                                                    }`}
                                            >
                                                {isCompleted ? (
                                                    <>
                                                        <CheckCircle2 className="size-3.5" />
                                                        Completed
                                                    </>
                                                ) : (
                                                    <>
                                                        <Check className="size-3.5" />
                                                        Mark as Read
                                                    </>
                                                )}
                                            </Button>

                                            {section.href && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    asChild
                                                    className="text-xs gap-1.5 text-primary hover:text-primary"
                                                >
                                                    <Link href={section.href}>
                                                        Go to {section.title}
                                                        <TrendingUp className="size-3" />
                                                    </Link>
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Completion Message */}
                {progress === 100 && (
                    <div className="text-center py-8 space-y-3 animate-in fade-in zoom-in-95 duration-500">
                        <div className="inline-flex h-16 w-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 items-center justify-center text-white shadow-lg mx-auto">
                            <GraduationCap className="size-8" />
                        </div>
                        <h2 className="text-xl font-bold">
                            🎉 Tutorial Complete!
                        </h2>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto">
                            You&apos;ve reviewed all sections. You&apos;re now ready to make
                            the most of Feed Reminder. Happy farming!
                        </p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => saveProgress([])}
                            className="text-xs mt-2"
                        >
                            Reset Progress
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
