// user.controller.js
import * as userService from '../services/user.service.js'

export const getUsers = async (req, res) => {
  const users = await userService.getUsers()
  res.json(users)
}