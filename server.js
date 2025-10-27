const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const app = express();
const adapter = new FileSync('db.json');
const db = low(adapter);

// Set default data in db.json
db.defaults({ todos: [] }).write();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Routes
// Get all todos
app.get('/api/todos', (req, res) => {
  const todos = db.get('todos').value();
  res.json(todos);
});

// Add a new todo
app.post('/api/todos', (req, res) => {
  const todo = {
    id: Date.now().toString(),
    title: req.body.title,
    content: req.body.content,
    completed: false,
    createdAt: new Date().toISOString()
  };
  
  db.get('todos')
    .push(todo)
    .write();
  
  res.status(201).json(todo);
});

// Update a todo
app.put('/api/todos/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  db.get('todos')
    .find({ id })
    .assign(updates)
    .write();
  
  const updatedTodo = db.get('todos')
    .find({ id })
    .value();
  
  res.json(updatedTodo);
});

// Delete a todo
app.delete('/api/todos/:id', (req, res) => {
  const { id } = req.params;
  
  db.get('todos')
    .remove({ id })
    .write();
  
  res.status(204).end();
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
