/**
 * components/ui/PillSelect.tsx — Sélecteur de type "pill" (badges cliquables)
 *
 * Usage mono-sélection :
 *   <PillSelect options={[...]} value="ble_tendre" onChange={setValue} />
 *
 * Usage multi-sélection :
 *   <PillSelect options={[...]} value={[...]} onChange={setValues} multiSelect />
 */
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '@/constants/Colors';

interface Option {
  value: string;
  label: string;
}

// Surcharge mono
interface PillSelectSingleProps {
  options: Option[];
  value: string | null;
  onChange: (value: string) => void;
  multiSelect?: false;
}

// Surcharge multi
interface PillSelectMultiProps {
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  multiSelect: true;
}

type PillSelectProps = PillSelectSingleProps | PillSelectMultiProps;

export function PillSelect(props: PillSelectProps) {
  const { options, multiSelect } = props;

  const isSelected = (v: string) => {
    if (multiSelect) return (props.value as string[]).includes(v);
    return props.value === v;
  };

  const toggle = (v: string) => {
    if (multiSelect) {
      const current = props.value as string[];
      const next = current.includes(v)
        ? current.filter(x => x !== v)
        : [...current, v];
      (props.onChange as (v: string[]) => void)(next);
    } else {
      (props.onChange as (v: string) => void)(v);
    }
  };

  return (
    <View style={styles.container}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt.value}
          style={[styles.pill, isSelected(opt.value) && styles.pillActive]}
          onPress={() => toggle(opt.value)}
          activeOpacity={0.75}
        >
          <Text style={[styles.pillText, isSelected(opt.value) && styles.pillTextActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  pillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pillText:       { fontSize: 13, color: Colors.textMuted, fontWeight: '500' },
  pillTextActive: { color: '#fff', fontWeight: '600' },
});
