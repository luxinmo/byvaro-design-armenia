export interface TeamMember {
  id: string;
  name: string;
  role: string;
  jobTitle: string;
  avatar: string;
  email: string;
  phone: string;
  phonePrefix: string;
  languages: string[];
  status: "active" | "pending" | "deactive" | "invited";
  visibleOnProfile: boolean;
  systemRole: string;
  canSign?: boolean;
  canAcceptRegistrations?: boolean;
}

export const teamMembers: TeamMember[] = [];

export const activeTeamMembers = teamMembers.filter(m => m.status === "active");
