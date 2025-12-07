import { host } from "@/host.js"

export async function submitLogin(values: { email: string; password: string }) {
  try {
    const res = await fetch(`${host}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Login failed");
    }

    return data; // contains { token }
  } catch (err: any) {
    throw new Error(err.message);
  }
}
