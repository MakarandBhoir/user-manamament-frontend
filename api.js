// Reusable API client for the user management backend.
(function () {
    const BASE_URL = "https://tcs-usermanagement-backend.azurewebsites.net/";

    async function request(path, options = {}) {
        const response = await fetch(`${BASE_URL}${path}`, {
            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {}),
            },
            ...options,
        });

        const rawBody = await response.text();
        let parsedBody = null;

        if (rawBody) {
            try {
                parsedBody = JSON.parse(rawBody);
            } catch (error) {
                parsedBody = rawBody;
            }
        }

        if (!response.ok) {
            const error = new Error(`API request failed with status ${response.status}`);
            error.status = response.status;
            error.body = parsedBody;
            throw error;
        }

        return parsedBody;
    }

    function sanitizePayload(data) {
        return {
            name: data.name.trim(),
            email: data.email.trim(),
            password: data.password,
            role: data.role,
        };
    }

    window.userApi = {
        BASE_URL,
        getUsers() {
            return request("users");
        },
        getUserById(id) {
            return request(`users/${id}`);
        },
        createUser(data) {
            return request("users", {
                method: "POST",
                body: JSON.stringify(sanitizePayload(data)),
            });
        },
        updateUser(id, data) {
            return request(`users/${id}`, {
                method: "PUT",
                body: JSON.stringify({
                    id,
                    ...sanitizePayload(data),
                }),
            });
        },
        deleteUser(id) {
            return request(`users/${id}`, {
                method: "DELETE",
            });
        },
    };
})();