import { describe, expect, it } from "vitest";
import {
  suppliedBirthBagChecklist,
  withSuppliedChecklists,
} from "./supplied-checklists";

describe("Borsa parto fornita da Gaia", () => {
  it("keeps stable, unique UUIDs for every activity and its future server row", () => {
    const uuids = [
      suppliedBirthBagChecklist.id,
      ...suppliedBirthBagChecklist.items.map((item) => item.id),
    ];
    expect(new Set(uuids).size).toBe(19);
    expect(
      uuids.every((id) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
          id,
        ),
      ),
    ).toBe(true);
    expect(suppliedBirthBagChecklist.items).toHaveLength(18);
  });

  it("keeps the supplied mother, documents and baby groups with optional oil caution", () => {
    const notes = suppliedBirthBagChecklist.items.map(
      (item) => item.note || "",
    );
    expect(notes.some((note) => note.startsWith("Per te ·"))).toBe(true);
    expect(notes.some((note) => note.startsWith("Documenti ·"))).toBe(true);
    expect(notes.some((note) => note.startsWith("Per il bambino ·"))).toBe(
      true,
    );
    const oils = suppliedBirthBagChecklist.items.find((item) =>
      item.id.endsWith("1408"),
    );
    expect(oils?.note).toContain("Facoltativo da valutare con ostetrica");
    expect(oils?.note).toContain(
      "Non applicare né diffondere oli essenziali sul neonato",
    );
    expect(oils?.note).toContain(
      "senza un’indicazione professionale specifica",
    );
  });

  it("adds the supplied document once, preserving a server edition and other checklists", () => {
    const unrelated = {
      ...suppliedBirthBagChecklist,
      id: "unrelated",
      title: "Altro",
    };
    const initial = [unrelated];
    const merged = withSuppliedChecklists(initial);
    expect(initial).toEqual([unrelated]);
    expect(merged).toEqual([suppliedBirthBagChecklist, unrelated]);
    const serverEdition = {
      ...suppliedBirthBagChecklist,
      title: "Edizione aggiornata",
    };
    const serverContent = [unrelated, serverEdition];
    expect(withSuppliedChecklists(serverContent)).toBe(serverContent);
    expect(withSuppliedChecklists(withSuppliedChecklists([]))).toHaveLength(1);
  });
});
