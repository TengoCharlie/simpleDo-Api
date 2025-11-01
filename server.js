const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const connectDB = require("./config/db");
const Todo = require("./models/Todo");
const User = require("./models/User");
const auth = require("./middleware/auth");

// Initialize express app
const app = express();

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be defined in the environment variables");
}

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Utility to create a predictable user shape for API responses
const buildUserResponse = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
});

// Generate a signed JWT containing the user's identifier
const generateToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });

// Authentication routes
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, and password are required" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });

    if (existingUser) {
      return res.status(409).json({ message: "Email already in use" });
    }

    // Password hashing handled by the model hook
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
    });

    const token = generateToken(user._id);

    res.status(201).json({
      token,
      user: buildUserResponse(user),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user._id);

    res.json({
      token,
      user: buildUserResponse(user),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/auth/profile", auth, (req, res) => {
  res.json({ user: buildUserResponse(req.user) });
});

app.put("/api/auth/profile", auth, async (req, res) => {
  try {
    const { name, email, password, currentPassword } = req.body;
    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (email && email.toLowerCase() !== user.email) {
      const emailInUse = await User.findOne({ email: email.toLowerCase() });
      if (emailInUse && emailInUse._id.toString() !== user._id.toString()) {
        return res.status(409).json({ message: "Email already in use" });
      }
      user.email = email.toLowerCase();
    }

    if (name) {
      user.name = name;
    }

    if (password) {
      if (!currentPassword) {
        return res
          .status(400)
          .json({ message: "Current password required to set a new password" });
      }

      const isCurrentValid = await user.matchPassword(currentPassword);

      if (!isCurrentValid) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      user.password = password; // Will be re-hashed by the model hook
    }

    await user.save();

    res.json({
      token: generateToken(user._id),
      user: buildUserResponse(user),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Todo routes (protected)
app.get("/api/todos", auth, async (req, res) => {
  try {
    const todos = await Todo.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(todos);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/todos", auth, async (req, res) => {
  try {
    const { title, content } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }

    const todo = new Todo({
      title,
      content,
      user: req.user._id,
    });

    const newTodo = await todo.save();
    res.status(201).json(newTodo);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.put("/api/todos/:id", auth, async (req, res) => {
  try {
    const updates = {};

    if (typeof req.body.title !== "undefined") {
      updates.title = req.body.title;
    }

    if (typeof req.body.content !== "undefined") {
      updates.content = req.body.content;
    }

    if (typeof req.body.completed !== "undefined") {
      updates.completed = req.body.completed;
    }

    if (Object.keys(updates).length === 0) {
      return res
        .status(400)
        .json({ message: "Provide at least one field to update" });
    }

    const todo = await Todo.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      updates,
      { new: true }
    );

    if (!todo) {
      return res.status(404).json({ message: "Todo not found" });
    }

    res.json(todo);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.delete("/api/todos/:id", auth, async (req, res) => {
  try {
    const todo = await Todo.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!todo) {
      return res.status(404).json({ message: "Todo not found" });
    }

    res.status(204).end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
