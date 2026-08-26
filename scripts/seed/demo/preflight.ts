/**
 * Refuse the whole plan rather than the first bad row in it.
 *
 * `plan.ts`, `companies.ts` and `activity.ts` are dates and names, and both
 * can be wrong in ways the real writers would only discover four hundred acts
 * in: a thread raised before its project existed, a report naming a project
 * its company does not participate in, a rep logging against somebody else's
 * customer, a dispatch from a version the coordinator never issued.
 *
 * Each of those throws from a writer, with a message about the rule it broke —
 * which is the right message in the wrong place. Read against a data file it
 * says nothing about *which row*, and it arrives one at a time, after the
 * database has already been cleared.
 *
 * So every cross-reference and every ordering is checked here, together,
 * **before anything is cleared**. A failing run costs nothing and names every
 * problem at once.
 */

import { COMPANIES } from "./companies";
import { PEOPLE, type PersonKey } from "./people";
import { DISPATCHES, PROJECTS, THREADS } from "./plan";
import { COMMENTS, FOLLOW_UPS, REPORTS, SHARES } from "./activity";

export function preflight(): void {
  const bad: string[] = [];

  const companyAge = new Map(COMPANIES.map((c) => [c.name, c.age]));
  const ownerOf = new Map<string, PersonKey>(
    COMPANIES.map((c) => [c.name, c.owner]),
  );
  const projectAge = new Map(PROJECTS.map((p) => [p.key, p.age]));
  const projectOwner = new Map(PROJECTS.map((p) => [p.key, p.owner]));
  const participants = new Map(
    PROJECTS.map((p) => [p.key, new Set<string>(p.companies)]),
  );
  const threadRow = new Map(THREADS.map((t) => [t.key, t]));

  /** A day number is days BEFORE today, so a bigger number is earlier. */
  const company = (label: string, name: string, at: number): void => {
    const age = companyAge.get(name);
    if (age === undefined) {
      bad.push(`${label}: no company "${name}"`);
      return;
    }
    if (at > age) {
      bad.push(`${label}: day -${at} is before the company existed (-${age})`);
    }
  };

  const project = (label: string, key: string, at: number): void => {
    const age = projectAge.get(key);
    if (age === undefined) {
      bad.push(`${label}: no project "${key}"`);
      return;
    }
    if (at > age) {
      bad.push(`${label}: day -${at} is before ${key} existed (-${age})`);
    }
  };

  /** Acts must not run backwards: each one is at or after the one before it. */
  const ordered = (label: string, days: (number | undefined)[]): void => {
    const seen = days.filter((d): d is number => d !== undefined);
    for (let i = 1; i < seen.length; i += 1) {
      if (seen[i] > seen[i - 1]) {
        bad.push(`${label}: acts run backwards — ${seen.join(" → ")}`);
        break;
      }
    }
  };

  for (const row of PROJECTS) {
    for (const name of row.companies) company(`project ${row.key}`, name, row.age);
    ordered(`project ${row.key}`, [
      row.age,
      row.inProduction,
      row.committed,
      row.lost?.day,
    ]);
  }

  for (const row of THREADS) {
    company(`thread ${row.key}`, row.company, row.raised);
    if (row.project) {
      project(`thread ${row.key}`, row.project, row.raised);
      // `S51` — a quotation always names a company, and `createQuotationThread`
      // refuses one that is not a participant of the project it names.
      if (!participants.get(row.project)?.has(row.company)) {
        bad.push(`thread ${row.key}: ${row.company} is not on ${row.project}`);
      }
      // `S30` — a project is visible only to its owner, so the rep raising the
      // quotation has to be the one who holds it.
      if (projectOwner.get(row.project) !== ownerOf.get(row.company)) {
        bad.push(`thread ${row.key}: ${row.project} belongs to another rep [S30]`);
      }
    }
    ordered(`thread ${row.key}`, [
      row.raised,
      ...(row.revisions ?? []),
      row.issued,
      row.accepted,
    ]);
    // An end state is final: `setEndState` refuses a second one, and the
    // screen offers neither reject nor cancel once a thread is accepted.
    if (row.accepted !== undefined && (row.rejected !== undefined || row.cancelled !== undefined)) {
      bad.push(`thread ${row.key}: an accepted thread cannot then be rejected or cancelled [S62]`);
    }
    for (const [name, at] of [
      ["returned", row.returned],
      ["rejected", row.rejected],
      ["cancelled", row.cancelled],
    ] as const) {
      if (at !== undefined && at > row.raised) {
        bad.push(`thread ${row.key}: ${name} at -${at}, before it was raised`);
      }
    }
  }

  for (const row of DISPATCHES) {
    const label = `dispatch ${row.key}`;
    if (row.thread) {
      const thread = threadRow.get(row.thread);
      if (!thread) {
        bad.push(`${label}: no thread "${row.thread}"`);
      } else if (thread.issued === undefined || row.requested > thread.issued) {
        // `S126` — only an issued version may be dispatched against.
        bad.push(`${label}: ${row.thread} was not issued by day -${row.requested}`);
      }
    } else if (!row.company) {
      bad.push(`${label}: a free entry needs a company [S75]`);
    } else {
      company(label, row.company, row.requested);
    }
    if (row.project) project(label, row.project, row.requested);
    // `S119` — South and Dammam stock have no trucks, so a dispatch from
    // either is CT. The database holds the same rule; this says which row.
    if ((row.stock === "south" || row.stock === "dammam") && row.shipment !== "ct") {
      bad.push(`${label}: ${row.stock} stock must ship CT [S119]`);
    }
    if (row.cargo && row.shipment !== "cargo") {
      bad.push(`${label}: a destination note belongs to Cargo only [S119]`);
    }
    ordered(label, [
      row.requested,
      row.editedByRep,
      row.submitted,
      row.editedByCoord,
      row.approved ?? row.refused,
      row.revived ?? row.cancelled,
    ]);
  }

  for (const [index, row] of REPORTS.entries()) {
    const label = `report ${index} (${row.company ?? "field note"} -${row.day})`;
    if (row.company) {
      company(label, row.company, row.day);
      // `S38` — the author has to be able to see the record, and in this
      // dataset that means the rep who holds it.
      if (ownerOf.get(row.company) !== row.by) {
        bad.push(`${label}: ${row.by} does not hold this company`);
      }
      if (row.project) {
        project(label, row.project, row.day);
        if (!participants.get(row.project)?.has(row.company)) {
          bad.push(`${label}: the company is not on ${row.project}`);
        }
        if (projectOwner.get(row.project) !== row.by) {
          bad.push(`${label}: ${row.project} belongs to another rep [S30]`);
        }
      }
    } else if (!row.category) {
      bad.push(`${label}: a field note needs a category [S33]`);
    }
  }

  // A comment follows its anchor `S131`, so the author has to be able to see
  // the record — its owner, or somebody the manager shared it with by then.
  const sharedProjects = new Set(
    SHARES.filter((s) => s.type === "project").map((s) => `${s.target}|${s.to}`),
  );
  const sharedThreads = new Set(
    SHARES.filter((s) => s.type === "quotation_thread").map((s) => `${s.target}|${s.to}`),
  );
  for (const row of COMMENTS) {
    const at =
      row.on === "project"
        ? projectAge.get(row.target)
        : threadRow.get(row.target)?.raised;
    if (at === undefined) {
      bad.push(`comment on ${row.target}: no such record`);
      continue;
    }
    if (row.day > at) bad.push(`comment on ${row.target}: before it existed`);
    const owner =
      row.on === "project"
        ? projectOwner.get(row.target)
        : ownerOf.get(threadRow.get(row.target)!.company);
    const shared =
      row.on === "project"
        ? sharedProjects.has(`${row.target}|${row.by}`)
        : sharedThreads.has(`${row.target}|${row.by}`);
    const elevated = PEOPLE.find((p) => p.key === row.by)?.books === 0;
    if (owner !== row.by && !shared && !elevated) {
      bad.push(`comment on ${row.target}: ${row.by} cannot see it [S131]`);
    }
  }

  for (const row of SHARES) {
    if (row.type === "company") company(`share ${row.target}`, row.target, row.day);
    else if (row.type === "project") project(`share ${row.target}`, row.target, row.day);
    else {
      const at = threadRow.get(row.target)?.raised;
      if (at === undefined) bad.push(`share ${row.target}: no such thread`);
      else if (row.day > at) bad.push(`share ${row.target}: before it was raised`);
    }
  }

  for (const row of FOLLOW_UPS) {
    // The date is set through the writer at today or later and then moved back
    // with its own batch, so it cannot have arrived before it was set.
    if (row.arrived !== undefined && row.arrived > row.setOn) {
      bad.push(`follow-up on ${row.target}: it arrived before it was set`);
    }
  }

  // `people.ts` states each book size as intent; `companies.ts` is the fact.
  // Two files disagreeing about how uneven the books are is exactly what `D34`
  // is being demonstrated with, so it is worth a loud failure.
  const books = new Map<PersonKey, number>();
  for (const row of COMPANIES) {
    books.set(row.owner, (books.get(row.owner) ?? 0) + 1);
  }
  for (const person of PEOPLE) {
    const actual = books.get(person.key) ?? 0;
    if (actual !== person.books) {
      bad.push(
        `people.ts says ${person.key} holds ${person.books} companies; ` +
          `companies.ts has ${actual}`,
      );
    }
  }

  if (bad.length > 0) {
    throw new Error(
      `The plan does not hold together — ${bad.length} problem(s):\n  ` +
        bad.join("\n  "),
    );
  }
}
