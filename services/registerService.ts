import { host } from "@/host.js"

export async function submitRegister(values: { username: string; email: string; password: string }) {
    try{
        const response = await fetch(`${host}/user`, {
            method: "POST",
            headers: {
            "Content-Type": "application/json",
            },
            body: JSON.stringify(values),
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || "Registration failed");
        }
        return data; // contains { message: "User registered successfully" }
    } catch (err: any) {
        throw new Error(err.message);
    }
}
