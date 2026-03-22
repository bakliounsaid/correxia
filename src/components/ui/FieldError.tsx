/** Message d’erreur sous un champ (formulaires classiques) */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1.5 text-xs font-medium text-error-600" role="alert">
      {message}
    </p>
  );
}
