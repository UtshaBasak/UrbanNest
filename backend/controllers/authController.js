import User from '../models/user.model.js'

export const signup = async (req, res) => {
  const { email, password } = req.body
  // ...validate input...

  // Generate unique username
  const username = 'user_' + Date.now() + Math.floor(Math.random() * 1000)

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10)

  // Send OTP to jihadul.nishan@gmail.com
  // ...generate OTP...
  // ...send email using nodemailer...

  // Save user with isAdmin flag if email matches ADMIN_EMAIL
  const isAdmin = email === process.env.ADMIN_EMAIL
  const user = new User({ email, password: hashedPassword, username, isAdmin })
  await user.save()

  res.status(201).json({ message: 'Signup successful. OTP sent for verification.' })
}
