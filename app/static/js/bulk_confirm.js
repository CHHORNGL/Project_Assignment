(function () {
    const escapeHtml = (value) => {
        const div = document.createElement("div");
        div.textContent = value == null ? "" : String(value);
        return div.innerHTML;
    };
    const toPlainText = (html) => {
        return String(html).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    };

    const buildTable = (columns, rows) => {
        if (!rows.length) return "";
        const headerCells = columns.map(col => `<th>${escapeHtml(col.label)}</th>`).join("");
        const header = `<tr>${headerCells}</tr>`;
        const body = rows.map(row => {
            const cells = columns.map(col => `<td>${escapeHtml(row[col.key])}</td>`).join("");
            return `<tr>${cells}</tr>`;
        }).join("");
        return `<div class="table-responsive mt-2">
            <table class="table table-sm table-bordered mb-0">
                <thead class="thead-light">${header}</thead>
                <tbody>${body}</tbody>
            </table>
        </div>`;
    };

    const copyText = async (text) => {
        if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
        return false;
    };

    class BulkConfirmController {
        constructor(options) {
            this.form = document.getElementById(options.formId);
            this.scopeField = document.getElementById(options.scopeFieldId);
            this.applyAll = document.getElementById(options.applyAllId);
            this.toggle = document.getElementById(options.selectAllId);
            this.modal = document.getElementById(options.modalId);
            this.modalBody = document.getElementById(options.modalBodyId);
            this.confirmBtn = document.getElementById(options.modalConfirmId);
            this.copyBtn = document.getElementById(options.modalCopyId);
            this.modalTitle = document.getElementById(options.modalTitleId);
            this.rowSelector = options.rowSelector;
            this.previewColumns = options.previewColumns;
            this.getPreviewRow = options.getPreviewRow;
            this.getFiltersLabel = options.getFiltersLabel;
            this.actionLabel = options.actionLabel;
            this.itemLabel = options.itemLabel || "item(s)";
            this.confirmLabel = options.confirmLabel;
            this.confirmIsDanger = options.confirmIsDanger;
            this.allowedActions = options.allowedActions || ["delete", "export_csv", "export_json"];
            this.pendingSubmit = false;
            this.modalOpen = false;
            this.modalBaseTitle = options.modalBaseTitle || "Confirm Bulk Action";
            this.init();
        }

        rowChecks() {
            return document.querySelectorAll(this.rowSelector);
        }

        setModalTitle(text) {
            if (this.modalTitle) this.modalTitle.textContent = text;
        }

        setConfirmButton(action) {
            if (!this.confirmBtn) return;
            let isDanger = action === "delete";
            if (typeof this.confirmIsDanger === "function") {
                isDanger = !!this.confirmIsDanger(action);
            }
            let label = isDanger ? "Confirm Delete" : "Confirm Export";
            if (typeof this.confirmLabel === "function") {
                const customLabel = this.confirmLabel(action);
                if (customLabel) label = customLabel;
            }
            this.confirmBtn.classList.toggle("btn-danger", isDanger);
            this.confirmBtn.classList.toggle("btn-primary", !isDanger);
            this.confirmBtn.textContent = label;
        }

        showModal(messageHtml, selectedCount, action) {
            if (this.modalBody) this.modalBody.innerHTML = messageHtml;
            this.setConfirmButton(action);
            const titleSuffix = selectedCount != null ? ` (${selectedCount})` : "";
            this.setModalTitle(`${this.modalBaseTitle}${titleSuffix}`);
            if (this.modal && window.jQuery) {
                this.pendingSubmit = true;
                window.jQuery(this.modal).modal("show");
                return true;
            }
            return false;
        }

        async handleCopy() {
            if (!this.modalBody) return;
            const text = toPlainText(this.modalBody.innerHTML);
            const ok = await copyText(text);
            if (ok && this.copyBtn) {
                const original = this.copyBtn.textContent;
                this.copyBtn.textContent = "Copied";
                setTimeout(() => {
                    this.copyBtn.textContent = original;
                }, 1200);
            }
        }

        init() {
            if (!this.form) return;

            if (this.applyAll) {
                this.applyAll.addEventListener("change", () => {
                    const checked = this.applyAll.checked;
                    if (this.scopeField) this.scopeField.value = checked ? "all" : "selected";
                    this.rowChecks().forEach(cb => {
                        cb.checked = false;
                        cb.disabled = checked;
                    });
                    if (this.toggle) this.toggle.checked = false;
                });
            }

            if (this.toggle) {
                this.toggle.addEventListener("change", () => {
                    this.rowChecks().forEach(cb => {
                        cb.checked = this.toggle.checked;
                    });
                });
            }

            this.form.addEventListener("submit", (event) => {
                const actionSelect = this.form.querySelector("select[name='action']");
                const action = actionSelect ? actionSelect.value : "";
                if (!action || !this.allowedActions.includes(action)) {
                    alert("Select a bulk action.");
                    event.preventDefault();
                    return;
                }

                const scope = this.scopeField ? this.scopeField.value : "selected";
                const actionLabel = this.actionLabel(action);

                if (scope === "all") {
                    const total = this.form.dataset.total || "0";
                    const filterText = this.getFiltersLabel(this.form);
                    const messageHtml = `<div><strong>${escapeHtml(actionLabel)} ${escapeHtml(total)}</strong> ${escapeHtml(this.itemLabel)} for all filtered results.</div>
                        <div class="text-muted small">Filters: ${escapeHtml(filterText)}</div>`;
                    const modalShown = this.showModal(messageHtml, total, action);
                    if (modalShown) {
                        event.preventDefault();
                        return;
                    }
                    if (!confirm(toPlainText(messageHtml))) {
                        event.preventDefault();
                    }
                    return;
                }

                const selected = Array.from(this.rowChecks()).filter(cb => cb.checked);
                if (!selected.length) {
                    alert("Select at least one item.");
                    event.preventDefault();
                    return;
                }

                const previewRows = selected.slice(0, 5).map(cb => this.getPreviewRow(cb));
                const messageHtml = `<div><strong>${escapeHtml(actionLabel)} ${escapeHtml(selected.length)}</strong> selected ${escapeHtml(this.itemLabel)}?</div>
                    <div class="text-muted small">Preview (first ${escapeHtml(previewRows.length)}):</div>
                    ${buildTable(this.previewColumns, previewRows)}`;
                const modalShown = this.showModal(messageHtml, selected.length, action);
                if (modalShown) {
                    event.preventDefault();
                    return;
                }
                if (!confirm(toPlainText(messageHtml))) {
                    event.preventDefault();
                }
            });

            if (this.confirmBtn) {
                this.confirmBtn.addEventListener("click", () => {
                    if (!this.pendingSubmit || !this.form) return;
                    this.pendingSubmit = false;
                    if (this.modal && window.jQuery) {
                        window.jQuery(this.modal).modal("hide");
                    }
                    this.form.submit();
                });
            }

            if (this.copyBtn) {
                this.copyBtn.addEventListener("click", () => {
                    this.handleCopy();
                });
            }

            if (this.modal && window.jQuery) {
                window.jQuery(this.modal).on("hidden.bs.modal", () => {
                    this.pendingSubmit = false;
                    this.modalOpen = false;
                });
                window.jQuery(this.modal).on("shown.bs.modal", () => {
                    this.modalOpen = true;
                });
            }

            document.addEventListener("keydown", (event) => {
                if (!this.modalOpen) return;
                if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                    event.preventDefault();
                    if (this.confirmBtn) this.confirmBtn.click();
                }
            });
        }
    }

    window.BulkConfirmController = BulkConfirmController;
})();
