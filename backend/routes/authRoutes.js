import express from 'express'
import { signup } from '../controllers/authController.js'

const router = express.Router()

router.post('/signup', signup)
// ...other auth routes...

export default router
