export const createAccount = async (userData) => {
  const response = await fetch(
    "http://YOUR_IP_ADDRESS:5000/api/create-account",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        full_name: userData.name,
        email: userData.email,
        password: userData.password,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message);
  }

  return data;
};