// src/services/userService.js

function sanitizeId(id) {
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0) {
    throw new Error('INVALID_USER_ID');
  }
  return num;
}

async function fetchUserFromDB(id) {
  // Giả lập truy vấn DB với delay 10-30ms
  await new Promise(resolve => setTimeout(resolve, 10 + Math.floor(Math.random() * 21)));
  return {
    id: Number(id),
    username: id === 1 ? 'guest' : `user_${id}`,
    role: 'viewer',
    createdAt: new Date().toISOString(),
  };
}

module.exports = {
  fetchUserFromDB,
  sanitizeId,
};
