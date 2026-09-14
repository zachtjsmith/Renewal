import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

const el = document.getElementById("root");
if (!el) throw new Error('No #root element — check index.html');
createRoot(el).render(<React.StrictMode><App /></React.StrictMode>);
