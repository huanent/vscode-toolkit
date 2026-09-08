import type { Connection, RowDataPacket } from 'mysql2/promise';

interface MysqlCreateTableColumn {
	name: string;
	originalName?: string;
	type: string;
	length: string;
	nullable: boolean;
	primaryKey: boolean;
	autoIncrement: boolean;
	defaultKind: 'none' | 'null' | 'currentTimestamp' | 'value';
	defaultValue: string;
}

interface MysqlCreateTableDefinition {
	name: string;
	columns: MysqlCreateTableColumn[];
}

const createTableColumnTypes = new Set([
	'BIGINT',
	'INT',
	'SMALLINT',
	'TINYINT',
	'BIT',
	'DECIMAL',
	'VARCHAR',
	'CHAR',
	'TEXT',
	'LONGTEXT',
	'BOOLEAN',
	'DATE',
	'DATETIME',
	'TIMESTAMP',
	'TIME',
	'JSON',
	'BLOB',
]);
const integerColumnTypes = new Set(['BIGINT', 'INT', 'SMALLINT', 'TINYINT']);
const lengthColumnTypes = new Set(['BIT', 'DECIMAL', 'VARCHAR', 'CHAR']);
const currentTimestampColumnTypes = new Set(['DATETIME', 'TIMESTAMP']);

export function parseCreateTableDefinition(
	value: unknown,
	existingTables: Set<string>,
	originalTableName?: string,
	originalColumnNames = new Set<string>(),
): MysqlCreateTableDefinition {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error('Invalid table definition.');
	}
	const definition = value as Record<string, unknown>;
	const name = parseMysqlIdentifier(definition.name, 'Table name');
	if (existingTables.has(name) && name !== originalTableName) {
		throw new Error(`A table named “${name}” already exists.`);
	}
	if (!Array.isArray(definition.columns) || definition.columns.length === 0) {
		throw new Error('Add at least one column.');
	}
	const columnNames = new Set<string>();
	const mappedOriginalColumnNames = new Set<string>();
	let autoIncrementColumns = 0;
	const columns = definition.columns.map((value, index) => {
		if (!value || typeof value !== 'object' || Array.isArray(value)) {
			throw new Error(`Column ${index + 1} is invalid.`);
		}
		const input = value as Record<string, unknown>;
		const columnName = parseMysqlIdentifier(input.name, `Column ${index + 1} name`);
		const submittedOriginalName =
			typeof input.originalName === 'string' ? input.originalName : undefined;
		if (submittedOriginalName && !originalColumnNames.has(submittedOriginalName)) {
			throw new Error(
				`Column “${submittedOriginalName}” has changed or no longer exists. Reload the table definition.`,
			);
		}
		const originalName = submittedOriginalName;
		if (originalName && mappedOriginalColumnNames.has(originalName)) {
			throw new Error(`Original column “${originalName}” is mapped more than once.`);
		}
		if (originalName) {
			mappedOriginalColumnNames.add(originalName);
		}
		if (columnNames.has(columnName)) {
			throw new Error(`Column name “${columnName}” is duplicated.`);
		}
		columnNames.add(columnName);
		const type = typeof input.type === 'string' ? input.type.toUpperCase() : '';
		if (!createTableColumnTypes.has(type)) {
			throw new Error(`Column “${columnName}” has an unsupported type.`);
		}
		const length = typeof input.length === 'string' ? input.length.trim() : '';
		if (length && (!lengthColumnTypes.has(type) || !/^\d+(?:,\d+)?$/.test(length))) {
			throw new Error(`Column “${columnName}” has an invalid length.`);
		}
		if (
			type === 'BIT' &&
			length &&
			(!/^\d+$/.test(length) || Number(length) < 1 || Number(length) > 64)
		) {
			throw new Error(`Column “${columnName}” must have a bit length from 1 to 64.`);
		}
		if ((type === 'VARCHAR' || type === 'CHAR') && !length) {
			throw new Error(`Column “${columnName}” requires a length.`);
		}
		const primaryKey = input.primaryKey === true;
		const autoIncrement = input.autoIncrement === true;
		if (autoIncrement && (!integerColumnTypes.has(type) || !primaryKey)) {
			throw new Error(`Auto increment column “${columnName}” must be an integer primary key.`);
		}
		if (autoIncrement && ++autoIncrementColumns > 1) {
			throw new Error('Only one column can use auto increment.');
		}
		const defaultKind = input.defaultKind;
		if (
			defaultKind !== 'none' &&
			defaultKind !== 'null' &&
			defaultKind !== 'currentTimestamp' &&
			defaultKind !== 'value'
		) {
			throw new Error(`Column “${columnName}” has an invalid default value.`);
		}
		const validatedDefaultKind: MysqlCreateTableColumn['defaultKind'] = defaultKind;
		const nullable = input.nullable === true && !primaryKey;
		if (validatedDefaultKind === 'null' && !nullable) {
			throw new Error(`Column “${columnName}” must be nullable to default to NULL.`);
		}
		if (validatedDefaultKind === 'currentTimestamp' && !currentTimestampColumnTypes.has(type)) {
			throw new Error(`Column “${columnName}” cannot default to CURRENT_TIMESTAMP.`);
		}
		return {
			name: columnName,
			originalName,
			type,
			length,
			nullable,
			primaryKey,
			autoIncrement,
			defaultKind: validatedDefaultKind,
			defaultValue: typeof input.defaultValue === 'string' ? input.defaultValue : '',
		};
	});
	return { name, columns };
}

function parseMysqlIdentifier(value: unknown, label: string): string {
	const identifier = typeof value === 'string' ? value.trim() : '';
	if (!identifier) {
		throw new Error(`${label} is required.`);
	}
	if (Buffer.byteLength(identifier, 'utf8') > 64) {
		throw new Error(`${label} must be 64 bytes or fewer.`);
	}
	return identifier;
}

function escapeMysqlIdentifier(identifier: string): string {
	return `\`${identifier.replaceAll('`', '``')}\``;
}

export async function readTableDefinition(
	connection: Connection,
	database: string,
	table: string,
): Promise<MysqlCreateTableDefinition> {
	const [rows] = await connection.query<RowDataPacket[]>(
		`SELECT COLUMN_NAME AS name, DATA_TYPE AS dataType, IS_NULLABLE AS isNullable,
			COLUMN_KEY AS columnKey, COLUMN_DEFAULT AS columnDefault, EXTRA AS extra,
			CHARACTER_MAXIMUM_LENGTH AS characterLength, NUMERIC_PRECISION AS numericPrecision,
			NUMERIC_SCALE AS numericScale
		FROM information_schema.COLUMNS
		WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
		ORDER BY ORDINAL_POSITION`,
		[database, table],
	);
	if (rows.length === 0) {
		throw new Error(`Table “${table}” no longer exists.`);
	}
	const columns = rows.map(row => {
		const type = String(row.dataType).toUpperCase();
		if (!createTableColumnTypes.has(type)) {
			throw new Error(`Column “${String(row.name)}” uses unsupported type ${type}.`);
		}
		let length = '';
		if ((type === 'VARCHAR' || type === 'CHAR') && row.characterLength !== null) {
			length = String(row.characterLength);
		} else if (type === 'BIT' && row.numericPrecision !== null) {
			length = String(row.numericPrecision);
		} else if (type === 'DECIMAL' && row.numericPrecision !== null) {
			length = `${String(row.numericPrecision)},${String(row.numericScale ?? 0)}`;
		}
		const defaultValue = row.columnDefault === null ? '' : String(row.columnDefault);
		const nullable = row.isNullable === 'YES';
		const defaultKind: MysqlCreateTableColumn['defaultKind'] =
			row.columnDefault === null
				? nullable
					? 'null'
					: 'none'
				: currentTimestampColumnTypes.has(type) &&
					  /^current_timestamp(?:\(\d+\))?$/i.test(defaultValue)
					? 'currentTimestamp'
					: 'value';
		return {
			name: String(row.name),
			originalName: String(row.name),
			type,
			length,
			nullable,
			primaryKey: row.columnKey === 'PRI',
			autoIncrement: String(row.extra ?? '')
				.toLowerCase()
				.includes('auto_increment'),
			defaultKind,
			defaultValue: defaultKind === 'value' ? defaultValue : '',
		};
	});
	return { name: table, columns };
}

function buildColumnDefinition(
	column: MysqlCreateTableColumn,
	escapeValue: (value: string) => string,
): string {
	const length = column.length ? `(${column.length})` : '';
	const nullable = column.nullable && !column.primaryKey ? ' NULL' : ' NOT NULL';
	let defaultClause = '';
	if (column.defaultKind === 'null') {
		defaultClause = ' DEFAULT NULL';
	} else if (column.defaultKind === 'currentTimestamp') {
		defaultClause = ' DEFAULT CURRENT_TIMESTAMP';
	} else if (column.defaultKind === 'value') {
		defaultClause = ` DEFAULT ${escapeValue(column.defaultValue)}`;
	}
	return `${escapeMysqlIdentifier(column.name)} ${column.type}${length}${nullable}${defaultClause}${column.autoIncrement ? ' AUTO_INCREMENT' : ''}`;
}

export function buildCreateTableSql(
	definition: MysqlCreateTableDefinition,
	database: string,
	escapeValue: (value: string) => string,
): string {
	const columnSql = definition.columns.map(column => {
		return `  ${buildColumnDefinition(column, escapeValue)}`;
	});
	const primaryKeys = definition.columns.filter(column => column.primaryKey);
	if (primaryKeys.length > 0) {
		columnSql.push(
			`  PRIMARY KEY (${primaryKeys.map(column => escapeMysqlIdentifier(column.name)).join(', ')})`,
		);
	}
	return `CREATE TABLE ${escapeMysqlIdentifier(database)}.${escapeMysqlIdentifier(definition.name)} (\n${columnSql.join(',\n')}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;
}

export function buildAlterTableSql(
	original: MysqlCreateTableDefinition,
	definition: MysqlCreateTableDefinition,
	database: string,
	escapeValue: (value: string) => string,
): string {
	const clauses: string[] = [];
	const originalColumns = new Map(original.columns.map(column => [column.name, column]));
	const desiredOriginalNames = new Set(
		definition.columns.flatMap(column => (column.originalName ? [column.originalName] : [])),
	);
	for (const column of original.columns) {
		if (!desiredOriginalNames.has(column.name)) {
			clauses.push(`  DROP COLUMN ${escapeMysqlIdentifier(column.name)}`);
		}
	}
	for (const column of definition.columns) {
		if (column.originalName) {
			const originalColumn = originalColumns.get(column.originalName);
			if (!originalColumn || !sameColumnDefinition(originalColumn, column)) {
				clauses.push(
					`  CHANGE COLUMN ${escapeMysqlIdentifier(column.originalName)} ${buildColumnDefinition(column, escapeValue)}`,
				);
			}
		} else {
			clauses.push(`  ADD COLUMN ${buildColumnDefinition(column, escapeValue)}`);
		}
	}
	const originalPrimaryKeys = original.columns
		.filter(column => column.primaryKey)
		.map(column => column.name);
	const primaryKeyColumns = definition.columns.filter(column => column.primaryKey);
	const desiredOriginalPrimaryKeys = primaryKeyColumns.map(
		column => column.originalName ?? column.name,
	);
	if (!sameStringArray(originalPrimaryKeys, desiredOriginalPrimaryKeys)) {
		if (originalPrimaryKeys.length > 0) {
			clauses.push('  DROP PRIMARY KEY');
		}
		if (primaryKeyColumns.length > 0) {
			clauses.push(
				`  ADD PRIMARY KEY (${primaryKeyColumns.map(column => escapeMysqlIdentifier(column.name)).join(', ')})`,
			);
		}
	}
	if (definition.name !== original.name) {
		clauses.push(
			`  RENAME TO ${escapeMysqlIdentifier(database)}.${escapeMysqlIdentifier(definition.name)}`,
		);
	}
	if (clauses.length === 0) {
		throw new Error('No table changes to apply.');
	}
	return `ALTER TABLE ${escapeMysqlIdentifier(database)}.${escapeMysqlIdentifier(original.name)}\n${clauses.join(',\n')};`;
}

function sameColumnDefinition(
	original: MysqlCreateTableColumn,
	column: MysqlCreateTableColumn,
): boolean {
	return (
		original.name === column.name &&
		original.type === column.type &&
		original.length === column.length &&
		original.nullable === column.nullable &&
		original.autoIncrement === column.autoIncrement &&
		original.defaultKind === column.defaultKind &&
		original.defaultValue === column.defaultValue
	);
}

function sameStringArray(left: string[], right: string[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}
