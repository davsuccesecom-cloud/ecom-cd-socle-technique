import "./firebaseConfig"; // doit s'exécuter avant tout usage de @ecomcod/shared
import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/index.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
