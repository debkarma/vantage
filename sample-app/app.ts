process.env.VANTAGE_MODE = process.env.VANTAGE_MODE || 'off';
import express from 'express';
import { vantageMiddleware } from '../src/sdk/express.js';

const app = express();
app.use(express.json());

// 1. Add Vantage Middleware (it only does something if VANTAGE_MODE=record)
app.use(vantageMiddleware);

// --- Sample App Logic ---
let todos = [
  { id: 1, title: 'Learn Keploy and Vantage' },
  { id: 2, title: 'Build Vantage' }
];

app.get('/api/todos', (req, res) => {
  res.json(todos);
});

app.post('/api/todos', (req, res) => {
  const { title } = req.body;
  if(!title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  const newTodo = { id: todos.length + 1, title };
  todos.push(newTodo);
  res.status(201).json(newTodo);
});

app.put('/api/todos/:id', (req, res) => {
  const { id } = req.params;
  const { title } = req.body;
  const todo = todos.find(t => t.id === parseInt(id));
  if (todo) {
    todo.title = title;
    res.json(todo);
  } else {
    res.status(404).json({ error: 'Todo not found' });
  }
});

app.delete('/api/todos/:id', (req, res) => {
  const { id } = req.params;
  todos = todos.filter(t => t.id !== parseInt(id));
  res.status(204).send();
});

export default app;
