import { IconButton } from '../../../../components/ui/button';
import { X } from '../../../../components/ui/icons';
import { List, ListItem } from '../../../../components/ui/list';
import { Popover } from '../../../../components/ui/popover';

export function Favorites({
    paths,
    activePath,
    onSelect,
    onRemove,
    anchorElement,
    open,
    onOpenChange,
}: {
    anchorElement: HTMLElement | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    paths: string[];
    activePath: string;
    onSelect: (path: string) => void;
    onRemove: (path: string) => void;
}) {
    return (
        <Popover
            open={open}
            onOpenChange={onOpenChange}
            anchorElement={anchorElement}
            matchAnchorWidth
            autoFocus={false}
            label="Favorite paths"
            className="p-1"
        >
            <List>
                {paths.map(path => (
                    <ListItem
                        key={path}
                        selected={path === activePath}
                        onSelect={() => onSelect(path)}
                        actions={
                            <IconButton
                                size="sm"
                                title="Remove from favorites"
                                label={`Remove ${path} from favorites`}
                                icon={<X size="xs" />}
                                onClick={event => {
                                    event.stopPropagation();
                                    onRemove(path);
                                }}
                            />
                        }
                    >
                        {path}
                    </ListItem>
                ))}
            </List>
        </Popover>
    );
}
