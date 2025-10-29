import { host } from "@/host.js"

export async function getUser(token: string) {
  if (!token) {
    throw new Error("No auth token found");
  }

  const res = await fetch(`${host}/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch profile");
  }

  const data = await res.json();
  console.log("Fetch profile json:", data);

  return data;
}
