const generateId = (prefix) => {
  const date = new Date();
  const year = date.getFullYear();
  const random = Math.floor(10000 + Math.random() * 90000).toString();
  return `${prefix}-${year}-${random}`;
};

module.exports = generateId;
