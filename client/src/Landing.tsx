import React, { useState } from "react";

const Landing = () => {
  const [form, setForm] = useState({
    install_cmd: "",
    package_name: "",
    start_cmd: "",
    port: 3333,
    spec_url: "",
    auth_env: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === "port" ? Number(value) : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log(form);
  };

  return (
    <form
      className="flex flex-col items-center justify-center min-h-screen space-y-4"
      onSubmit={handleSubmit}
    >
      <input
        type="text"
        name="install_cmd"
        placeholder="Install Command (e.g. npx @playwright/mcp@latest)"
        className="p-2 text-lg w-full max-w-md border border-gray-300 rounded"
        value={form.install_cmd}
        onChange={handleChange}
        required
      />
      <input
        type="text"
        name="package_name"
        placeholder="Package Name"
        className="p-2 text-lg w-full max-w-md border border-gray-300 rounded"
        value={form.package_name}
        onChange={handleChange}
        required
      />
      <input
        type="text"
        name="start_cmd"
        placeholder="Start Command (optional)"
        className="p-2 text-lg w-full max-w-md border border-gray-300 rounded"
        value={form.start_cmd}
        onChange={handleChange}
      />
      <input
        type="number"
        name="port"
        placeholder="Port (default: 3333)"
        className="p-2 text-lg w-full max-w-md border border-gray-300 rounded"
        value={form.port}
        onChange={handleChange}
      />
      <input
        type="text"
        name="spec_url"
        placeholder="Spec URL (optional)"
        className="p-2 text-lg w-full max-w-md border border-gray-300 rounded"
        value={form.spec_url}
        onChange={handleChange}
      />
      <input
        type="text"
        name="auth_env"
        placeholder="Auth Env (optional)"
        className="p-2 text-lg w-full max-w-md border border-gray-300 rounded"
        value={form.auth_env}
        onChange={handleChange}
      />
      <button
        type="submit"
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Submit
      </button>
    </form>
  );
};

export default Landing;
