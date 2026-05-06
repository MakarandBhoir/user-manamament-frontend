// Main UI controller for the static user management dashboard.
(function () {
    const state = {
        users: [],
        filteredUsers: [],
        page: 1,
        pageSize: 6,
        sort: "name-asc",
        query: "",
        editingId: null,
        deleteCandidate: null,
        busy: false,
        theme: localStorage.getItem("ump-theme") || "light",
    };

    const elements = {
        apiBaseUrl: document.getElementById("api-base-url"),
        activeUsersCount: document.getElementById("active-users-count"),
        cancelDelete: document.getElementById("cancel-delete"),
        clearErrorLog: document.getElementById("clear-error-log"),
        confirmCopy: document.getElementById("confirm-copy"),
        confirmDelete: document.getElementById("confirm-delete"),
        confirmModal: document.getElementById("confirm-modal"),
        email: document.getElementById("email"),
        errorLog: document.getElementById("error-log"),
        form: document.getElementById("user-form"),
        formMessage: document.getElementById("form-message"),
        formModeLabel: document.getElementById("form-mode-label"),
        heroCreate: document.getElementById("hero-create"),
        heroRefresh: document.getElementById("hero-refresh"),
        lastSyncTime: document.getElementById("last-sync-time"),
        name: document.getElementById("name"),
        navLinks: Array.from(document.querySelectorAll(".nav-link")),
        nextPage: document.getElementById("next-page"),
        pageIndicator: document.getElementById("page-indicator"),
        paginationSummary: document.getElementById("pagination-summary"),
        password: document.getElementById("password"),
        prevPage: document.getElementById("prev-page"),
        refreshUsers: document.getElementById("refresh-users"),
        resetForm: document.getElementById("reset-form"),
        role: document.getElementById("role"),
        searchUsers: document.getElementById("search-users"),
        sections: Array.from(document.querySelectorAll(".section-panel")),
        shortcutButtons: Array.from(document.querySelectorAll("[data-shortcut]")),
        sortUsers: document.getElementById("sort-users"),
        submitUser: document.getElementById("submit-user"),
        tableLoading: document.getElementById("table-loading"),
        tbody: document.getElementById("users-tbody"),
        themeButtons: Array.from(document.querySelectorAll(".theme-btn")),
        toastContainer: document.getElementById("toast-container"),
        totalUsersCount: document.getElementById("total-users-count"),
        userId: document.getElementById("user-id"),
        visibleUsersCount: document.getElementById("visible-users-count"),
    };

    function init() {
        elements.apiBaseUrl.textContent = window.userApi.BASE_URL;
        applyTheme(state.theme);
        bindEvents();
        warnIfLocalFileMode();
        loadUsers();
    }

    function bindEvents() {
        elements.navLinks.forEach((button) => {
            button.addEventListener("click", () => showSection(button.dataset.sectionTarget));
        });

        elements.shortcutButtons.forEach((button) => {
            button.addEventListener("click", () => {
                const target = button.dataset.shortcut === "users" ? "users-section" : "form-section";
                showSection(target);
            });
        });

        elements.heroCreate.addEventListener("click", () => showSection("form-section"));
        elements.heroRefresh.addEventListener("click", () => loadUsers());
        elements.refreshUsers.addEventListener("click", () => loadUsers());
        elements.searchUsers.addEventListener("input", handleSearch);
        elements.sortUsers.addEventListener("change", handleSortChange);
        elements.prevPage.addEventListener("click", () => changePage(-1));
        elements.nextPage.addEventListener("click", () => changePage(1));
        elements.form.addEventListener("submit", handleSubmit);
        elements.resetForm.addEventListener("click", resetForm);
        elements.cancelDelete.addEventListener("click", closeDeleteModal);
        elements.confirmDelete.addEventListener("click", handleDeleteConfirmed);
        elements.clearErrorLog.addEventListener("click", clearErrorLog);
        elements.themeButtons.forEach((btn) => {
            btn.addEventListener("click", () => setTheme(btn.dataset.theme));
        });

        elements.confirmModal.addEventListener("click", (event) => {
            if (event.target === elements.confirmModal) {
                closeDeleteModal();
            }
        });
    }

    async function loadUsers() {
        setLoading(true);
        setBusy(true);

        try {
            const users = await window.userApi.getUsers();
            state.users = Array.isArray(users) ? users : [];
            updateLastSync();
            applyFilters();
            renderSummary();
            showToast("Users loaded successfully.", "success");
        } catch (error) {
            logApiError(error);
            renderSummary();
            renderTable();
            showToast("Failed to load users. See diagnostics for details.", "error");
        } finally {
            setLoading(false);
            setBusy(false);
        }
    }

    function handleSearch(event) {
        state.query = event.target.value.trim().toLowerCase();
        state.page = 1;
        applyFilters();
    }

    function handleSortChange(event) {
        state.sort = event.target.value;
        state.page = 1;
        applyFilters();
    }

    function applyFilters() {
        const query = state.query;
        let nextUsers = [...state.users];

        if (query) {
            nextUsers = nextUsers.filter((user) => {
                return [user.name, user.email, user.role, String(user.id)]
                    .filter(Boolean)
                    .some((value) => String(value).toLowerCase().includes(query));
            });
        }

        const [field, direction] = state.sort.split("-");

        nextUsers.sort((left, right) => {
            const leftValue = String(left[field] || "").toLowerCase();
            const rightValue = String(right[field] || "").toLowerCase();

            if (leftValue === rightValue) {
                return 0;
            }

            const comparison = leftValue > rightValue ? 1 : -1;
            return direction === "asc" ? comparison : -comparison;
        });

        state.filteredUsers = nextUsers;
        clampPage();
        renderSummary();
        renderTable();
    }

    function clampPage() {
        const totalPages = Math.max(1, Math.ceil(state.filteredUsers.length / state.pageSize));
        if (state.page > totalPages) {
            state.page = totalPages;
        }
    }

    function renderSummary() {
        const totalUsers = state.users.length;
        const activeUsers = state.users.filter((user) => !String(user.role || "").toLowerCase().includes("viewer")).length;
        const visibleUsers = state.filteredUsers.length;

        elements.totalUsersCount.textContent = String(totalUsers);
        elements.activeUsersCount.textContent = String(activeUsers);
        elements.visibleUsersCount.textContent = String(visibleUsers);
    }

    function renderTable() {
        if (!state.filteredUsers.length) {
            elements.tbody.innerHTML = '<tr><td colspan="5" class="empty-state-cell">No users match the current filters.</td></tr>';
            updatePagination(0, 0, 0);
            return;
        }

        const start = (state.page - 1) * state.pageSize;
        const end = start + state.pageSize;
        const pageUsers = state.filteredUsers.slice(start, end);

        elements.tbody.innerHTML = pageUsers
            .map((user) => {
                return `
					<tr>
						<td>${escapeHtml(user.id)}</td>
						<td>${escapeHtml(user.name)}</td>
						<td>${escapeHtml(user.email)}</td>
						<td>${escapeHtml(user.role)}</td>
						<td>
							<div class="row-actions">
								<button class="action-button edit" type="button" data-action="edit" data-id="${user.id}">Edit</button>
								<button class="action-button delete" type="button" data-action="delete" data-id="${user.id}" data-name="${escapeAttribute(user.name)}">Delete</button>
							</div>
						</td>
					</tr>
				`;
            })
            .join("");

        elements.tbody.querySelectorAll("[data-action='edit']").forEach((button) => {
            button.addEventListener("click", () => beginEdit(button.dataset.id));
        });

        elements.tbody.querySelectorAll("[data-action='delete']").forEach((button) => {
            button.addEventListener("click", () => openDeleteModal(button.dataset.id, button.dataset.name));
        });

        updatePagination(start + 1, Math.min(end, state.filteredUsers.length), state.filteredUsers.length);
    }

    function updatePagination(start, end, total) {
        const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
        elements.pageIndicator.textContent = `Page ${state.page} of ${totalPages}`;
        elements.paginationSummary.textContent = total
            ? `Showing ${start}-${end} of ${total} users`
            : "Showing 0 users";
        elements.prevPage.disabled = state.page <= 1;
        elements.nextPage.disabled = state.page >= totalPages;
    }

    function changePage(delta) {
        const totalPages = Math.max(1, Math.ceil(state.filteredUsers.length / state.pageSize));
        const nextPage = Math.min(totalPages, Math.max(1, state.page + delta));

        if (nextPage !== state.page) {
            state.page = nextPage;
            renderTable();
        }
    }

    async function handleSubmit(event) {
        event.preventDefault();

        const payload = {
            name: elements.name.value,
            email: elements.email.value,
            password: elements.password.value,
            role: elements.role.value,
        };

        if (!state.editingId && !payload.password.trim()) {
            setFormMessage("Password is required when creating a user.", "error");
            return;
        }

        setBusy(true);
        setFormMessage("");

        try {
            if (state.editingId) {
                const userForUpdate = state.users.find((user) => String(user.id) === String(state.editingId));
                await window.userApi.updateUser(state.editingId, {
                    ...payload,
                    password: payload.password || userForUpdate?.password || "",
                });
                showToast("User updated successfully.", "success");
            } else {
                await window.userApi.createUser(payload);
                showToast("User created successfully.", "success");
            }

            resetForm();
            showSection("users-section");
            await loadUsers();
        } catch (error) {
            logApiError(error);
            setFormMessage(readableError(error), "error");
            showToast("User save failed.", "error");
        } finally {
            setBusy(false);
        }
    }

    async function beginEdit(id) {
        setBusy(true);
        setFormMessage("");

        try {
            const user = await window.userApi.getUserById(id);
            state.editingId = user.id;
            elements.userId.value = user.id;
            elements.name.value = user.name || "";
            elements.email.value = user.email || "";
            elements.password.value = "";
            elements.role.value = user.role || "";
            elements.submitUser.textContent = "Update User";
            elements.formModeLabel.textContent = `Mode: Edit user #${user.id}`;
            showSection("form-section");
        } catch (error) {
            logApiError(error);
            showToast("Unable to load the selected user.", "error");
        } finally {
            setBusy(false);
        }
    }

    function openDeleteModal(id, name) {
        state.deleteCandidate = id;
        elements.confirmCopy.textContent = `This will permanently remove ${name || `user #${id}`}.`;
        elements.confirmModal.classList.remove("hidden");
    }

    function closeDeleteModal() {
        state.deleteCandidate = null;
        elements.confirmModal.classList.add("hidden");
    }

    async function handleDeleteConfirmed() {
        if (!state.deleteCandidate) {
            return;
        }

        setBusy(true);

        try {
            await window.userApi.deleteUser(state.deleteCandidate);
            closeDeleteModal();
            showToast("User deleted successfully.", "success");
            await loadUsers();
        } catch (error) {
            logApiError(error);
            showToast("Delete failed.", "error");
        } finally {
            setBusy(false);
        }
    }

    function resetForm() {
        state.editingId = null;
        elements.form.reset();
        elements.userId.value = "";
        elements.submitUser.textContent = "Create User";
        elements.formModeLabel.textContent = "Mode: Create user";
        setFormMessage("");
    }

    function setFormMessage(message, tone) {
        elements.formMessage.textContent = message;
        elements.formMessage.className = "form-message";

        if (tone) {
            elements.formMessage.classList.add(tone);
        }
    }

    function showSection(targetId) {
        elements.sections.forEach((section) => {
            section.classList.toggle("active", section.id === targetId);
        });

        elements.navLinks.forEach((button) => {
            button.classList.toggle("active", button.dataset.sectionTarget === targetId);
        });
    }

    function setLoading(isLoading) {
        elements.tableLoading.classList.toggle("hidden", !isLoading);
    }

    function setBusy(isBusy) {
        state.busy = isBusy;
        const excludedIds = ["search-users", "sort-users"];
        document.querySelectorAll("button, input, select").forEach((element) => {
            if (excludedIds.includes(element.id) || element.classList.contains("theme-btn")) {
                return;
            }
            element.disabled = isBusy;
        });
    }

    function showToast(message, tone) {
        const toast = document.createElement("div");
        toast.className = `toast ${tone}`;
        toast.textContent = message;
        elements.toastContainer.appendChild(toast);

        window.setTimeout(() => {
            toast.remove();
        }, 3800);
    }

    function logApiError(error) {
        const payload = {
            time: new Date().toLocaleString(),
            message: error.message,
            status: error.status || "network",
            body: error.body || null,
            hint:
                "If the page is opened directly from file:// and the backend does not allow CORS, browser fetch calls can fail before reaching the API.",
        };

        elements.errorLog.textContent = JSON.stringify(payload, null, 2);
    }

    function clearErrorLog() {
        elements.errorLog.textContent = "No API errors logged.";
    }

    function warnIfLocalFileMode() {
        if (window.location.protocol !== "file:") {
            return;
        }

        elements.errorLog.textContent = JSON.stringify(
            {
                warning:
                    "This page is running from file://. If the backend does not send Access-Control-Allow-Origin for local file origins, live API calls may be blocked by the browser.",
                recommendedFix:
                    "Serve this folder with any static web server or enable CORS on the backend for the target origin.",
            },
            null,
            2
        );
    }

    function readableError(error) {
        if (error.body && typeof error.body === "object") {
            return error.body.message || JSON.stringify(error.body);
        }

        return error.message || "Unexpected API error.";
    }

    function updateLastSync() {
        elements.lastSyncTime.textContent = new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    }

    function setTheme(theme) {
        state.theme = theme;
        applyTheme(theme);
    }

    function applyTheme(theme) {
        document.body.classList.remove("dark-mode", "forest-mode");
        if (theme === "dark") {
            document.body.classList.add("dark-mode");
        } else if (theme === "forest") {
            document.body.classList.add("forest-mode");
        }
        elements.themeButtons.forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.theme === theme);
        });
        localStorage.setItem("ump-theme", theme);
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function escapeAttribute(value) {
        return escapeHtml(value).replace(/`/g, "&#96;");
    }

    init();
})();