export function TwitterFollow() {
  return (
    <div className="text-center mb-8">
      <a
        href="https://x.com/neuronz101"
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm bg-gray-50 px-3 py-1.5 rounded-full text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-colors inline-flex items-center gap-1"
      >
        Me siga no
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
        <span className="font-medium">@neuronz101</span>
      </a>
    </div>
  );
}
