export type DashboardDateFilter = "day" | "week" | "year" | "custom";

export interface DashboardSummary {
  range: {
    start: string;
    end: string;
    filter: string;
  };
  projects: {
    activeProjects: number;
    tasks: {
      todo: number;
      doing: number;
      done: number;
      total: number;
    };
    overdueTasks: number;
  };
  timekeeping: {
    checkedInToday: number;
    lateToday: number;
    totalEmployees: number;
    date: string;
    onApprovedLeaveToday?: number;
    absentWithoutLeave?: number;
  };
  chat: {
    unreadMessages: number;
    roomCount: number;
  };
  resources: {
    fileCount: number;
    recentUploads: number;
    totalSize: number;
  };
  training: {
    totalCourses: number;
    ongoingCourses: number;
    enrollments: {
      notStarted: number;
      inProgress: number;
      completed: number;
      total: number;
    };
  };
}

export interface DashboardActionItems {
  bulletin?: {
    role: "sales" | "technical" | "manager";
    cards: { title: string; value: string; detail: string; href?: string }[];
    updatedAt: string;
  };
  overdueTasks: { id: string; title: string; dueDate: string }[];
  pendingApprovals: { id: string; type: "leave"; employeeName: string; since: string }[];
  lowStockAlerts: { id: string; name: string; sku: string; stock: number; minStockAlert: number }[];
  contractExpiryAlerts: {
    id: string;
    contractType: string;
    employeeId: string;
    employeeName: string;
    endDate: string;
    daysRemaining: number;
    reminderDays: 3 | 7;
  }[];
}
