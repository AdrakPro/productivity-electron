/**
 * @typedef {Object} Todo
 * @property {number} id
 * @property {string} title
 * @property {string|null} description
 * @property {string|null} due_date - ISO date string (YYYY-MM-DD)
 * @property {boolean} is_global
 * @property {boolean} is_completed
 * @property {boolean} is_archived
 * @property {boolean} is_review
 * @property {string|null} completed_at - ISO datetime string
 * @property {string} created_at - ISO datetime string
 * @property {string} updated_at - ISO datetime string
 * @property {Subtask[]} subtasks
 */

/**
 * @typedef {Object} Subtask
 * @property {number} id
 * @property {number} todo_id
 * @property {string} title
 * @property {boolean} is_completed
 * @property {number} sort_order
 * @property {string|null} deadline - ISO date string (YYYY-MM-DD)
 * @property {string[]} tags
 * @property {string|null} completed_at - ISO datetime string
 * @property {string} created_at - ISO datetime string
 */

/**
 * @typedef {Object} Statistics
 * @property {number} total_completed
 * @property {number} current_streak
 * @property {number} longest_streak
 * @property {string|null} last_activity_date - ISO date string
 * @property {number} total_reviews_completed
 */

/**
 * @typedef {Object} Review
 * @property {number} id
 * @property {number} todo_id
 * @property {string} todo_title
 * @property {number} review_number - 1, 2, or 3
 * @property {string} review_date - ISO date string (YYYY-MM-DD)
 * @property {string} priority
 * @property {boolean} is_completed
 * @property {string|null} completed_at
 * @property {string} created_at
 */

/**
 * @typedef {Object} Streak
 * @property {number} id
 * @property {string} date - ISO date string (YYYY-MM-DD)
 * @property {number} completed_count
 * @property {string} created_at - ISO datetime string
 */

/**
 * @typedef {Object} FileNode
 * @property {string} name
 * @property {string} path
 * @property {boolean} isDirectory
 * @property {FileNode[]} [children]
 */

export {};
