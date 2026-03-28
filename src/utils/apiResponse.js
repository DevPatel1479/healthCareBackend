// apiResponse.js
export const success = (res, data) => {
  res.json({ success: true, data })
}