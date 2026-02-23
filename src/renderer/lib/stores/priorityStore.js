// Task priority levels
export const priorities = [
  {
    id: "none",
    label: "No Priority",
    color: null,
    textColor: "text-gray-400",
    bgLight: null,
  },
  {
    id: "low",
    label: "Low",
    color: "bg-blue-500",
    textColor: "text-blue-400",
    bgLight: "bg-blue-500/10",
  },
  {
    id: "medium",
    label: "Medium",
    color: "bg-yellow-500",
    textColor: "text-yellow-400",
    bgLight: "bg-yellow-500/10",
  },
  {
    id: "high",
    label: "High",
    color: "bg-orange-500",
    textColor: "text-orange-400",
    bgLight: "bg-orange-500/10",
  },
  {
    id: "urgent",
    label: "Urgent",
    color: "bg-red-500",
    textColor: "text-red-400",
    bgLight: "bg-red-500/10",
  },
];

// Task labels/tags with icons
export const defaultLabels = [
  { id: "work", label: "Work", color: "bg-blue-600", icon: "Briefcase" },
  { id: "personal", label: "Personal", color: "bg-green-600", icon: "User" },
  { id: "health", label: "Health", color: "bg-pink-600", icon: "Heart" },
  { id: "fitness", label: "Fitness", color: "bg-orange-600", icon: "Dumbbell" },
  {
    id: "finance",
    label: "Finance",
    color: "bg-yellow-600",
    icon: "DollarSign",
  },
  {
    id: "learning",
    label: "Learning",
    color: "bg-purple-600",
    icon: "GraduationCap",
  },
  { id: "home", label: "Home", color: "bg-teal-600", icon: "Home" },
  { id: "food", label: "Food", color: "bg-red-500", icon: "Utensils" },
  { id: "habits", label: "Habits", color: "bg-indigo-600", icon: "Repeat" },
  { id: "social", label: "Social", color: "bg-cyan-600", icon: "Users" },
];

export function getPriorityById(id) {
  return priorities.find((p) => p.id === id) || priorities[0];
}

export function getLabelById(id) {
  return defaultLabels.find((l) => l.id === id);
}

export function getLabelsByIds(ids) {
  if (!ids || !Array.isArray(ids)) return [];
  return ids.map((id) => getLabelById(id)).filter(Boolean);
}

// Subtask tags (fixed list, NOT inherited from parent)
export const subtaskTags = [
  { id: "c", label: "C", color: "bg-gray-600" },
  { id: "cpp", label: "C++", color: "bg-blue-700" },
  { id: "python", label: "Python", color: "bg-yellow-600" },
  { id: "cybersecurity", label: "Cybersecurity", color: "bg-red-700" },
  { id: "architecture", label: "Architecture", color: "bg-purple-700" },
  { id: "devops", label: "DevOps", color: "bg-cyan-700" },
];

export function getSubtaskTagById(id) {
  return subtaskTags.find((t) => t.id === id);
}

export function getSubtaskTagsByIds(ids) {
  if (!ids || !Array.isArray(ids)) return [];
  return ids.map((id) => getSubtaskTagById(id)).filter(Boolean);
}
