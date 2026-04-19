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

export const teamMembers: TeamMember[] = [
  {
    id: "req1", name: "New request", role: "", jobTitle: "", avatar: "",
    email: "montecarlo@gmail.com", phone: "", phonePrefix: "+34", languages: [],
    status: "pending", visibleOnProfile: false, systemRole: "",
  },
  {
    id: "inv1", name: "Aiko Nakamura", role: "Agent", jobTitle: "Agent", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop",
    email: "montecarlo@gmail.com", phone: "1722817218", phonePrefix: "+49", languages: ["ES", "DE", "FR"],
    status: "invited", visibleOnProfile: false, systemRole: "Accountant",
  },
  {
    id: "m1", name: "Haruki Saito", role: "Director", jobTitle: "Director", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop",
    email: "montecarlo@gmail.com", phone: "1722817218", phonePrefix: "+49", languages: ["ES", "DE", "FR"],
    status: "active", visibleOnProfile: false, systemRole: "Admin", canSign: true, canAcceptRegistrations: true,
  },
  {
    id: "m2", name: "Aiko Nakamura", role: "Accountant", jobTitle: "Accountant", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop",
    email: "montecarlo@gmail.com", phone: "1722817218", phonePrefix: "+49", languages: ["ES", "DE", "FR"],
    status: "active", visibleOnProfile: true, systemRole: "Accountant",
  },
  {
    id: "a1", name: "Joaquín Mendez Montecarlo", role: "Client Advisor", jobTitle: "Client Advisor", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop",
    email: "montecarlo@gmail.com", phone: "1722817218", phonePrefix: "+49", languages: ["ES", "DE", "FR"],
    status: "active", visibleOnProfile: true, systemRole: "Admin", canAcceptRegistrations: true,
  },
  {
    id: "a2", name: "Aiko Nakamura", role: "Agent", jobTitle: "Agent", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop",
    email: "montecarlo@gmail.com", phone: "1722817218", phonePrefix: "+49", languages: ["ES", "DE", "FR"],
    status: "active", visibleOnProfile: true, systemRole: "Seller",
  },
  {
    id: "a3", name: "Isabel Fernández", role: "Agent", jobTitle: "Agent", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop",
    email: "montecarlo@gmail.com", phone: "1722817218", phonePrefix: "+49", languages: ["ES", "DE", "FR"],
    status: "active", visibleOnProfile: true, systemRole: "Seller",
  },
  {
    id: "a4", name: "Sofía Morales", role: "Agent", jobTitle: "Agent", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop",
    email: "montecarlo@gmail.com", phone: "1722817218", phonePrefix: "+49", languages: ["ES", "DE", "FR"],
    status: "active", visibleOnProfile: true, systemRole: "Seller",
  },
];

export const activeTeamMembers = teamMembers.filter(m => m.status === "active");
