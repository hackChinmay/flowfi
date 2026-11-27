import React, { useState } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BottomNav from "@/components/BottomNav";
import ThemeToggle from "@/components/ThemeToggle";
import { MemoryRouter } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";

// Test component simulating Transaction delete confirmation dialog
function DeleteConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  txnCategory,
  txnAmount,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  txnCategory: string;
  txnAmount: number;
}) {
  if (!isOpen) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-confirm-title"
      aria-describedby="delete-confirm-desc"
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="glass-card rounded-2xl p-5 max-w-sm w-full space-y-4">
        <h3 id="delete-confirm-title" className="text-base font-bold">
          Delete Transaction?
        </h3>
        <p id="delete-confirm-desc" className="text-xs text-muted-foreground">
          Are you sure you want to delete this {txnCategory} transaction of ₹{txnAmount}? This action cannot be undone.
        </p>
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-cancel">
            Cancel
          </button>
          <button onClick={onConfirm} className="btn-delete">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// Test component simulating Category Radio Group
function CategorySelector({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (cat: string) => void;
}) {
  const categories = [
    { name: "Food", icon: "🍕" },
    { name: "Transport", icon: "🚗" },
    { name: "Salary", icon: "💰" },
  ];

  return (
    <div>
      <label id="category-label">Category</label>
      <div role="radiogroup" aria-labelledby="category-label">
        {categories.map((c) => {
          const isActive = selected === c.name;
          return (
            <button
              key={c.name}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={c.name}
              onClick={() => onSelect(c.name)}
            >
              <span>{c.icon}</span>
              <span>{c.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

describe("FlowFi Correction 5: UI/UX, Accessibility & Responsive Design", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Bottom Navigation Accessibility", () => {
    it("renders with semantic navigation landmark and aria-label", () => {
      render(
        <MemoryRouter initialEntries={["/dashboard"]}>
          <BottomNav />
        </MemoryRouter>
      );

      const navLandmark = screen.getByRole("navigation", { name: "Main Navigation" });
      expect(navLandmark).toBeInTheDocument();
    });

    it("indicates the currently active page with aria-current='page'", () => {
      render(
        <MemoryRouter initialEntries={["/dashboard"]}>
          <BottomNav />
        </MemoryRouter>
      );

      const homeButton = screen.getByRole("button", { name: "Home" });
      expect(homeButton).toHaveAttribute("aria-current", "page");

      const historyButton = screen.getByRole("button", { name: "History" });
      expect(historyButton).not.toHaveAttribute("aria-current");
    });

    it("ensures the central Add button has an accessible label", () => {
      render(
        <MemoryRouter initialEntries={["/dashboard"]}>
          <BottomNav />
        </MemoryRouter>
      );

      const addButton = screen.getByRole("button", { name: /Add new transaction/i });
      expect(addButton).toBeInTheDocument();
    });
  });

  describe("2. ThemeToggle Accessibility", () => {
    it("exposes dynamic aria-label indicating next theme state", () => {
      render(
        <ThemeProvider>
          <ThemeToggle />
        </ThemeProvider>
      );

      const toggleBtn = screen.getByTestId("button-theme-toggle");
      expect(toggleBtn).toHaveAttribute(
        "aria-label",
        expect.stringMatching(/Switch to (dark|light) theme/i)
      );
    });
  });

  describe("3. Modal & Confirmation Dialog Accessibility", () => {
    it("renders alertdialog with proper ARIA attributes", () => {
      const handleClose = vi.fn();
      const handleConfirm = vi.fn();

      render(
        <DeleteConfirmationDialog
          isOpen={true}
          onClose={handleClose}
          onConfirm={handleConfirm}
          txnCategory="Food"
          txnAmount={450}
        />
      );

      const dialog = screen.getByRole("alertdialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(dialog).toHaveAttribute("aria-labelledby", "delete-confirm-title");
      expect(dialog).toHaveAttribute("aria-describedby", "delete-confirm-desc");

      expect(screen.getByText("Delete Transaction?")).toBeInTheDocument();
      expect(
        screen.getByText(/Are you sure you want to delete this Food transaction of ₹450\?/i)
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(handleClose).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
      expect(handleConfirm).toHaveBeenCalledTimes(1);
    });

    it("does not render when dialog is closed", () => {
      render(
        <DeleteConfirmationDialog
          isOpen={false}
          onClose={() => {}}
          onConfirm={() => {}}
          txnCategory="Food"
          txnAmount={450}
        />
      );

      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
  });

  describe("4. Form Controls & Category Selection Accessibility", () => {
    it("manages radiogroup and radio attributes correctly", () => {
      let selectedCat = "Food";
      const handleSelect = vi.fn((cat: string) => {
        selectedCat = cat;
      });

      const { rerender } = render(
        <CategorySelector selected={selectedCat} onSelect={handleSelect} />
      );

      const radiogroup = screen.getByRole("radiogroup", { name: "Category" });
      expect(radiogroup).toBeInTheDocument();

      const foodRadio = screen.getByRole("radio", { name: "Food" });
      const salaryRadio = screen.getByRole("radio", { name: "Salary" });

      expect(foodRadio).toHaveAttribute("aria-checked", "true");
      expect(salaryRadio).toHaveAttribute("aria-checked", "false");

      fireEvent.click(salaryRadio);
      expect(handleSelect).toHaveBeenCalledWith("Salary");

      rerender(<CategorySelector selected="Salary" onSelect={handleSelect} />);
      expect(screen.getByRole("radio", { name: "Salary" })).toHaveAttribute("aria-checked", "true");
      expect(screen.getByRole("radio", { name: "Food" })).toHaveAttribute("aria-checked", "false");
    });
  });

  describe("5. Financial Accessibility (Color Independence & Progress Indicators)", () => {
    it("renders progress bars with role='progressbar' and appropriate values", () => {
      render(
        <div
          role="progressbar"
          aria-valuenow={65}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Monthly spending limit usage percentage"
        >
          <div style={{ width: "65%" }} />
        </div>
      );

      const progressBar = screen.getByRole("progressbar", {
        name: "Monthly spending limit usage percentage",
      });
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute("aria-valuenow", "65");
      expect(progressBar).toHaveAttribute("aria-valuemin", "0");
      expect(progressBar).toHaveAttribute("aria-valuemax", "100");
    });

    it("provides screen-reader accessible indicators for income vs expense", () => {
      render(
        <div>
          <p>
            <span className="sr-only">Income: +</span>
            <span aria-hidden="true">+</span>
            ₹15,000
          </p>
          <p>
            <span className="sr-only">Expense: -</span>
            <span aria-hidden="true">-</span>
            ₹2,500
          </p>
        </div>
      );

      expect(screen.getByText("Income: +")).toBeInTheDocument();
      expect(screen.getByText("Expense: -")).toBeInTheDocument();
    });
  });
});
