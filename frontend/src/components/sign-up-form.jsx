"use client";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

export function SignUpForm({ className, ...props }) {
  const navigate = useNavigate();
  const { register, loading, clearError } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [accountType, setAccountType] = useState("citizen");
  const [officialRole, setOfficialRole] = useState("ministry_officer");

  async function handleSubmit(e) {
    e.preventDefault();
    clearError();
    setSubmitting(true);

    const form = new FormData(e.target);
    const payload = {
      name: String(form.get("name") || "").trim(),
      email: String(form.get("email") || "").trim(),
      password: String(form.get("password") || ""),
      confirmPassword: String(form.get("confirmPassword") || ""),
      role: accountType === "government" ? officialRole : accountType,
      phone: String(form.get("phone") || "").trim(),
      address: String(form.get("address") || "").trim(),
      pincode: String(form.get("pincode") || "").trim(),
      wardNo: String(form.get("wardNo") || "").trim(),
      companyName: String(form.get("companyName") || "").trim(),
      registrationNumber: String(form.get("registrationNumber") || "").trim(),
      gstNumber: String(form.get("gstNumber") || "").trim(),
      ministryId: String(form.get("ministryId") || "").trim(),
      departmentId: String(form.get("departmentId") || "").trim(),
      regionId: String(form.get("regionId") || "").trim(),
    };

    if (payload.password !== payload.confirmPassword) {
      toast.error("Passwords do not match");
      setSubmitting(false);
      return;
    }

    if (payload.password.length < 8) {
      toast.error("Password must be at least 8 characters long");
      setSubmitting(false);
      return;
    }

    const result = await register(payload);
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.error || "Registration failed");
      return;
    }

    toast.success(`Welcome ${result.user?.name || "there"}!`);
    navigate("/dashboard", { replace: true });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("flex flex-col gap-6", className)}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Create an account</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Enter your details below to get started
          </p>
        </div>

        <Field>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input id="name" name="name" placeholder="Your Name" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" name="email" type="email" placeholder="m@example.com" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input id="password" name="password" type="password" required minLength={8} />
          <FieldDescription>
            Use at least 8 characters with uppercase, lowercase, a number, and a symbol.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="confirmPassword">Confirm Password</FieldLabel>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={8}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="phone">Phone</FieldLabel>
          <Input id="phone" name="phone" type="tel" placeholder="Optional" />
        </Field>

        <Field>
          <FieldLabel htmlFor="address">Address</FieldLabel>
          <Input id="address" name="address" placeholder="Optional" />
        </Field>

        <Field>
          <FieldLabel htmlFor="pincode">Pincode</FieldLabel>
          <Input id="pincode" name="pincode" placeholder="Optional" />
        </Field>

        <Field>
          <FieldLabel htmlFor="wardNo">Ward Number</FieldLabel>
          <Input id="wardNo" name="wardNo" placeholder="Optional for now" />
          <FieldDescription>
            You can add or update this later from your profile.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="accountType">Account Type</FieldLabel>
          <select
            id="accountType"
            name="accountType"
            value={accountType}
            onChange={(event) => setAccountType(event.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="citizen">Resident</option>
            <option value="contractor">Contractor</option>
            <option value="government">Government Official</option>
          </select>
        </Field>

        {accountType === "government" && (
          <>
            <Field>
              <FieldLabel htmlFor="officialRole">Official Role</FieldLabel>
              <select
                id="officialRole"
                name="officialRole"
                value={officialRole}
                onChange={(event) => setOfficialRole(event.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="admin">Administrator</option>
                <option value="ministry_officer">Ministry Officer</option>
                <option value="department_head">Department Head</option>
                <option value="senior_official">Senior Official</option>
                <option value="regional_manager">Regional Manager</option>
              </select>
            </Field>
            <Field>
              <FieldLabel htmlFor="ministryId">Ministry ID</FieldLabel>
              <Input id="ministryId" name="ministryId" placeholder="Optional for admin" />
            </Field>
            <Field>
              <FieldLabel htmlFor="departmentId">Department ID</FieldLabel>
              <Input id="departmentId" name="departmentId" placeholder="Optional" />
            </Field>
            <Field>
              <FieldLabel htmlFor="regionId">Region ID</FieldLabel>
              <Input id="regionId" name="regionId" placeholder="Required for regional manager" />
            </Field>
          </>
        )}

        {accountType === "contractor" && (
          <>
            <Field>
              <FieldLabel htmlFor="companyName">Company Name</FieldLabel>
              <Input id="companyName" name="companyName" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="registrationNumber">Registration Number</FieldLabel>
              <Input id="registrationNumber" name="registrationNumber" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="gstNumber">GST Number</FieldLabel>
              <Input id="gstNumber" name="gstNumber" />
            </Field>
          </>
        )}

        <Field>
          <Button type="submit" className="w-full" disabled={submitting || loading}>
            {submitting || loading ? "Creating account..." : "Create Account"}
          </Button>
        </Field>

        <FieldSeparator>Or continue with</FieldSeparator>

        <Field>
          <Button
            variant="outline"
            type="button"
            onClick={() => toast.info("GitHub signup coming soon")}
            className="flex items-center justify-center gap-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="w-4 h-4"
            >
              <path
                d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
                fill="currentColor"
              />
            </svg>
            Sign up with GitHub
          </Button>

          <FieldDescription className="text-center">
            Already have an account?{" "}
            <a
              href="/login"
              className="underline underline-offset-4 hover:text-primary"
            >
              Sign in
            </a>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
