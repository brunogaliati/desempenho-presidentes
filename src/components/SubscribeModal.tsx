"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { subscribeEmail } from "@/app/actions";

interface SubscribeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
    >
      {pending ? "Cadastrando..." : "Cadastrar"}
    </button>
  );
}

export function SubscribeModal({ isOpen, onClose }: SubscribeModalProps) {
  const formRef = useRef<HTMLFormElement>(null);

  if (!isOpen) return null;

  async function handleAction(formData: FormData) {
    const result = await subscribeEmail(formData);

    if (result.success) {
      formRef.current?.reset();
      setTimeout(onClose, 2000);
    }

    // Show the result message
    const messageEl = document.getElementById("message");
    if (messageEl) {
      messageEl.textContent = result.message;
      messageEl.className = `text-sm ${
        result.success ? "text-green-600" : "text-red-600"
      }`;
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-800">
            Receba atualizações
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <svg
              className="w-5 h-5 text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <form ref={formRef} action={handleAction} className="p-4">
          <p className="text-sm text-gray-600 mb-4">
            Cadastre seu email para receber notificações sobre atualizações nos
            dados.
          </p>
          <div className="space-y-4">
            <input
              type="email"
              name="email"
              required
              placeholder="Seu email"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500 bg-white"
            />
            <div id="message" className="text-sm"></div>
            <SubmitButton />
          </div>
        </form>
      </div>
    </div>
  );
}
