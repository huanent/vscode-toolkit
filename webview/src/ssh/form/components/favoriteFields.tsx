import { Button, IconButton } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Plus, Trash2 } from '../../../components/ui/icons';
import type { ConnectionFormState } from '../hooks/useForm';

export function FavoriteFields({ form }: { form: ConnectionFormState }) {
    const favorites = form.values.favorites;
    return (
        <section aria-label="Favorite paths" className="grid min-w-0 gap-3">
            {favorites.map((path, index) => (
                <Input
                    key={index}
                    aria-label={`Favorite path ${index + 1}`}
                    placeholder="/home"
                    value={path}
                    disabled={form.saving}
                    onChange={event => form.update('favorites', favorites.map((current, pathIndex) =>
                        pathIndex === index ? event.target.value : current,
                    ))}
                    right={
                        <IconButton
                            label={`Remove favorite path ${index + 1}`}
                            icon={<Trash2 size="md" />}
                            disabled={form.saving}
                            onClick={() => form.update('favorites', favorites.filter((_, pathIndex) => pathIndex !== index))}
                        />
                    }
                />
            ))}
            <Button
                variant="plain"
                aria-label="Add favorite path"
                title="Add favorite path"
                left={<Plus size="md" />}
                disabled={form.saving}
                onClick={() => form.update('favorites', [...favorites, ''])}
            />
        </section>
    );
}