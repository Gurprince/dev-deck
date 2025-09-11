// src/components/AIModal.jsx
import React, { useState } from "react";
import Modal from "react-modal";

Modal.setAppElement("#root"); // For accessibility

export default function AIModal({ isOpen, onClose, onSubmit }) {
  const [prompt, setPrompt] = useState("");

  const handleSubmit = () => {
    onSubmit(prompt);
    setPrompt("");
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      className="bg-slate-800 rounded-xl p-6 max-w-lg mx-auto mt-20 outline-none"
      overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center"
    >
      <h2 className="text-lg font-semibold font-['Inter'] text-slate-100 mb-4">
        AI Assistant
      </h2>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="w-full bg-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm font-mono h-32 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800"
        placeholder="Ask for code suggestions, bug fixes, or boilerplate..."
      />
      <div className="flex justify-end gap-2 mt-4">
        <button
          className="bg-slate-700 hover:bg-slate-600 text-slate-100 font-medium py-2 px-4 rounded-lg transition-all duration-300"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          className="bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded-lg transition-all duration-300"
          onClick={handleSubmit}
        >
          Submit
        </button>
      </div>
    </Modal>
  );
}
