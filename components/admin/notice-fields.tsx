import type { ActionState } from "@/lib/action-state";

const INPUT =
  "min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-ink focus:border-brand focus:outline-none";
const LABEL = "block text-sm font-semibold";

/**
 * What a notice is made of, whoever it goes to: a title, a message, and
 * optionally a button that leads somewhere inside the site.
 *
 * `values` is what the person had typed when a send was refused, so nothing has
 * to be written twice. `idPrefix` keeps the labels apart on a page that holds
 * one of these per account.
 */
export function NoticeFields({
  idPrefix,
  values,
}: {
  idPrefix: string;
  values?: ActionState["values"];
}) {
  return (
    <>
      <div className="space-y-2">
        <label className={LABEL} htmlFor={`${idPrefix}-title`}>
          Título
        </label>
        <input
          className={INPUT}
          defaultValue={values?.title}
          id={`${idPrefix}-title`}
          maxLength={120}
          name="title"
          required
          type="text"
        />
      </div>

      <div className="space-y-2">
        <label className={LABEL} htmlFor={`${idPrefix}-body`}>
          Mensaje
        </label>
        <textarea
          className={`${INPUT} min-h-28 py-2.5 leading-6`}
          defaultValue={values?.body}
          id={`${idPrefix}-body`}
          maxLength={2000}
          name="body"
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className={LABEL} htmlFor={`${idPrefix}-href`}>
            Enlace <span className="font-normal text-muted">(opcional)</span>
          </label>
          <input
            aria-describedby={`${idPrefix}-href-hint`}
            className={INPUT}
            defaultValue={values?.action_href}
            id={`${idPrefix}-href`}
            maxLength={300}
            name="action_href"
            placeholder="/panel"
            spellCheck={false}
            type="text"
          />
          <p className="text-xs leading-5 text-muted" id={`${idPrefix}-href-hint`}>
            Una ruta de la plaza, como /panel o /compras.
          </p>
        </div>

        <div className="space-y-2">
          <label className={LABEL} htmlFor={`${idPrefix}-label`}>
            Texto del botón <span className="font-normal text-muted">(con enlace)</span>
          </label>
          <input
            className={INPUT}
            defaultValue={values?.action_label}
            id={`${idPrefix}-label`}
            maxLength={40}
            name="action_label"
            placeholder="Ir a mi panel"
            type="text"
          />
        </div>
      </div>
    </>
  );
}

export function NoticeActionMessage({ state }: { state: ActionState }) {
  if (!state.message) return null;

  return (
    <p
      className={`w-full text-sm ${state.status === "error" ? "text-sale" : "text-success"}`}
      role="status"
    >
      {state.message}
    </p>
  );
}
