import { createContext, useContext, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { Menu, X } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';

type Icon = ComponentType<{ color?: string; size?: number }>;
export interface DrawerItem { label: string; href: string; icon: Icon; }
interface DrawerContextValue { open: () => void; }
const DrawerContext = createContext<DrawerContextValue | null>(null);

export function useMobileDrawer() {
  const value = useContext(DrawerContext);
  if (!value) throw new Error('MobileDrawer missing');
  return value;
}

export function DrawerLayout({ items, children }: { items: DrawerItem[]; children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { colors } = useTheme();
  const active = useMemo(() => items.find((item) => pathname.endsWith(item.href.split('/').pop() ?? ''))?.href, [items, pathname]);
  const navigate = (href: string) => { setVisible(false); router.push(href as never); };

  return (
    <DrawerContext.Provider value={{ open: () => setVisible(true) }}>
      {children}
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={{ width: '78%', maxWidth: 320, backgroundColor: colors.surface, paddingTop: 56, paddingHorizontal: 16 }}>
            <Pressable onPress={() => setVisible(false)} style={{ position: 'absolute', top: 16, right: 16, padding: 6 }}><X color={colors.muted} size={22} /></Pressable>
            <ScrollView showsVerticalScrollIndicator={false}>
              {items.map(({ label, href, icon: Icon }) => {
                const isActive = active === href;
                return <Pressable key={href} onPress={() => navigate(href)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 14, borderRadius: 12, marginBottom: 4, backgroundColor: isActive ? colors.primarySoft : 'transparent' }}><Icon color={isActive ? colors.primary : colors.muted} size={20} /><Text style={{ marginLeft: 12, color: isActive ? colors.primary : colors.ink, fontWeight: isActive ? '700' : '500', fontSize: 15 }}>{label}</Text></Pressable>;
              })}
            </ScrollView>
          </View>
          <Pressable onPress={() => setVisible(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} />
        </View>
      </Modal>
    </DrawerContext.Provider>
  );
}

export function DrawerHeader({ title }: { title: string }) {
  const { open } = useMobileDrawer();
  const { colors } = useTheme();
  return <View style={{ height: 54, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}><Pressable onPress={open} style={{ padding: 6, marginRight: 12 }}><Menu color={colors.ink} size={22} /></Pressable><Text style={{ color: colors.ink, fontSize: 18, fontWeight: '700' }}>{title}</Text></View>;
}
