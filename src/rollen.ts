export type Rolle = "admin" | "chef" | "polier" | "baustellen_leitung";

export const ROLLEN_LABEL: Record<Rolle, string> = {
  admin:              "Admin",
  chef:               "Chef",
  polier:             "Polier",
 baustellen_leitung: "Bauleitung",
};

export const ROLLE_TABS: Record<Rolle, number[]> = {
admin:              [0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11],
chef:               [0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11],
polier:             [0, 1, 3, 4, 5, 6, 7, 8, 9, 11],
baustellen_leitung: [0, 3, 9, 11],
};

export const KANN = {
  lohnSehen:         (r: Rolle) => r === "admin" || r === "chef",
  mitarbeiterEdit:   (r: Rolle) => r === "admin" || r === "chef" || r === "polier",
  baustellenAnlegen: (r: Rolle) => r === "admin" || r === "chef" || r === "polier",
  allesBaustellen:   (r: Rolle) => r !== "baustellen_leitung",
};