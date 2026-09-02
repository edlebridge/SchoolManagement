import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { Bell, Menu, X } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { AppNotification } from '@/lib/types';

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
  const { top } = useSafeAreaInsets();

  const active = useMemo(() => {
    return items.find((item) => {
      const seg = item.href.split('/').pop() ?? '';
      if (seg === '') return pathname === item.href || pathname === item.href + '/';
      return pathname.endsWith(seg);
    })?.href;
  }, [items, pathname]);

  const navigate = (href: string) => { setVisible(false); router.push(href as never); };

  return (
    <DrawerContext.Provider value={{ open: () => setVisible(true) }}>
      {children}
      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <Pressable style={{ flex: 1, flexDirection: 'row' }} onPress={() => setVisible(false)}>
          <Pressable style={{ width: '78%', maxWidth: 320, backgroundColor: colors.surface, paddingTop: top + 16, paddingHorizontal: 16 }} onPress={(e) => e.stopPropagation()}>
            <Pressable onPress={() => setVisible(false)} style={{ position: 'absolute', top: 16, right: 16, padding: 8, zIndex: 1 }}>
              <X color={colors.muted} size={22} />
            </Pressable>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
              {items.map(({ label, href, icon: Icon }) => {
                const isActive = active === href;
                return (
                  <Pressable key={href} onPress={() => navigate(href)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, borderRadius: 12, marginBottom: 4, backgroundColor: isActive ? colors.primarySoft : 'transparent' }}>
                    <Icon color={isActive ? colors.primary : colors.muted} size={20} />
                    <Text style={{ marginLeft: 14, color: isActive ? colors.primary : colors.ink, fontWeight: isActive ? '700' : '500', fontSize: 15 }}>{label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }} />
        </Pressable>
      </Modal>
    </DrawerContext.Provider>
  );
}

export function DrawerHeader({ title }: { title: string }) {
  const { open } = useMobileDrawer();
  const { colors } = useTheme();
  const { top } = useSafeAreaInsets();
  const { profile } = useAuth();
  const [unread, setUnread] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  const loadUnread = useCallback(async () => {
    if (!profile?.user_id) return;
    const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', profile.user_id).is('read_at', null);
    setUnread(count ?? 0);
  }, [profile?.user_id]);

  const loadNotifications = useCallback(async () => {
    if (!profile?.user_id) return;
    setLoadingNotifs(true);
    const { data } = await supabase.from('notifications').select('*').eq('user_id', profile.user_id).order('created_at', { ascending: false }).limit(20);
    setNotifications((data as AppNotification[]) ?? []);
    setLoadingNotifs(false);
  }, [profile?.user_id]);

  useEffect(() => { loadUnread(); }, [loadUnread]);

  const openNotifs = () => { setNotifOpen(true); loadNotifications(); };

  const markAllRead = async () => {
    if (!profile?.user_id) return;
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null).eq('user_id', profile.user_id);
    setUnread(0);
    loadNotifications();
  };

  return (
    <>
      <View style={{ height: top + 56, paddingTop: top, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={open} style={{ padding: 8, marginRight: 8 }}>
          <Menu color={colors.ink} size={24} />
        </Pressable>
        <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '700', flex: 1 }}>{title}</Text>
        <Pressable onPress={openNotifs} style={{ padding: 8, position: 'relative' }}>
          <Bell color={colors.ink} size={22} />
          {unread > 0 && (
            <View style={{ position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          )}
        </Pressable>
      </View>
      <Modal visible={notifOpen} transparent animationType="slide" onRequestClose={() => setNotifOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', paddingBottom: 30 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: colors.ink }}>Notifications</Text>
              <Pressable onPress={() => setNotifOpen(false)}><X color={colors.muted} size={22} /></Pressable>
            </View>
            {unread > 0 && (
              <Pressable onPress={markAllRead} style={{ paddingHorizontal: 20, paddingVertical: 10 }}>
                <Text style={{ color: colors.primary, fontWeight: '700' }}>Mark all as read</Text>
              </Pressable>
            )}
            <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}>
              {loadingNotifs ? (
                <Text style={{ color: colors.muted, textAlign: 'center', paddingVertical: 24 }}>Loading…</Text>
              ) : !notifications.length ? (
                <Text style={{ color: colors.muted, textAlign: 'center', paddingVertical: 24 }}>No notifications</Text>
              ) : (
                notifications.map((n) => (
                  <View key={n.id} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      {!n.read_at && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginRight: 8 }} />}
                      <Text style={{ fontWeight: '700', color: colors.ink, flex: 1 }}>{n.title}</Text>
                    </View>
                    {n.body ? <Text style={{ color: colors.muted, lineHeight: 20 }}>{n.body}</Text> : null}
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{new Date(n.created_at).toLocaleString()}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
