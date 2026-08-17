"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { redirect } from "@/i18n/navigation";
import { requireSession } from "@/lib/authz";
import { createContact, updateContact, type ContactInput } from "@/lib/contacts";
import { readFields, ruleErrorState, type FormState } from "@/lib/validation";

function readContactForm(formData: FormData) {
  const fields = readFields(formData);
  const input: ContactInput = {
    companyId: fields.uuid("companyId", { required: true }) ?? "",
    name: fields.text("name", { required: true, max: 200 }) ?? "",
    phone: fields.text("phone", { max: 50 }),
    email: fields.text("email", { max: 200 }),
    position: fields.text("position", { max: 120 }),
    notes: fields.text("notes", { max: 4000 }),
  };
  return { fields, input };
}

export async function createContactAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const { fields, input } = readContactForm(formData);
  if (!fields.ok) return fields.state;

  let contactId: string;
  try {
    const contact = await createContact(session, input);
    contactId = contact.id;
  } catch (error) {
    return ruleErrorState(error, fields.values);
  }

  const locale = await getLocale();
  revalidatePath("/contacts");
  revalidatePath(`/companies/${input.companyId}`);
  redirect({ href: `/contacts/${contactId}`, locale });
  throw new Error("unreachable"); // redirect() never returns
}

export async function updateContactAction(
  contactId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const { fields, input } = readContactForm(formData);
  if (!fields.ok) return fields.state;

  try {
    await updateContact(session, contactId, input);
  } catch (error) {
    return ruleErrorState(error, fields.values);
  }

  const locale = await getLocale();
  revalidatePath("/contacts");
  revalidatePath(`/companies/${input.companyId}`);
  redirect({ href: `/contacts/${contactId}`, locale });
  throw new Error("unreachable"); // redirect() never returns
}
