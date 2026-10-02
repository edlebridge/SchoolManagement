import { useEffect, useState, useCallback } from 'react';
import { Pressable, FlatList, Text, View, RefreshControl } from 'react-native';
import { Megaphone, ChevronRight } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { useParentMobile } from '@/context/ParentMobileContext';
import { supabase } from '@/lib/supabase';
import type { AppUser, ClassRow } from '@/lib/types';
import { Card, Empty, Loading, Badge } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useTheme } from '@/context/ThemeContext';

interface NoticeItem {
  id: string;
  title: string;
  body: string;
  author_id: string;
  authorName: string;
  audience: string;
  class_id: string | null;
  className: string | null;
  created_at: string;
  read: boolean;
}

const PAGE_SIZE = 10;

export default function ParentNoticeboard() {
  const { profile } = useAuth();
  const { children, selectedChild, loading: childLoading } = useParentMobile();
  const { colors, styles } = useTheme();
  const [items, setItems] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<NoticeItem | null>(null);
  const [page, setPage] = useState(0);
  const [authorMap, setAuthorMap] = useState<Record<string, string>>({});
  const [classMap, setClassMap] = useState<Record<string, string>>({});

  const buildQuery = (offset: number) => {
    if (!profile?.school_id) return null;
    let q = supabase
      .from('announcements')
      .select('*')
      .eq('school_id', profile.school_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (profile.role === 'parent') {
      const childClassIds = children.map((c) => c.class_id).filter(Boolean) as string[];
      q = q.or(`audience.eq.school,audience.eq.parents,audience.eq.class_all,audience.eq.class,audience.eq.emergency${childClassIds.length ? ',' + childClassIds.map((id) => `class_id.eq.${id}`).join(',') : ''}`);
    }
    return q;
  };

  const loadInitial = useCallback(async () => {
    if (!profile?.school_id || (profile.role === 'parent' && childLoading)) return;
    setLoading(true);
    setPage(0);
    setHasMore(true);

    const [{ data: authors }, { data: classes }] = await Promise.all([
      supabase.from('app_users').select('user_id,full_name').eq('school_id', profile.school_id),
      supabase.from('classes').select('id,name').eq('school_id', profile.school_id),
    ]);
    const am: Record<string, string> = {};
    (authors as { user_id: string; full_name: string }[])?.forEach((a) => { am[a.user_id] = a.full_name; });
    setAuthorMap(am);
    const cm: Record<string, string> = {};
    (classes as ClassRow[])?.forEach((c) => { cm[c.id] = c.name; });
    setClassMap(cm);

    const q = buildQuery(0);
    if (!q) { setLoading(false); return; }
    const { data } = await q;
    const announcements = (data as any[]) ?? [];
    const mapped: NoticeItem[] = announcements.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body ?? '',
      author_id: a.author_id,
      authorName: am[a.author_id] ?? 'School',
      audience: a.audience,
      class_id: a.class_id,
      className: a.class_id ? (cm[a.class_id] ?? null) : null,
      created_at: a.created_at,
      read: false,
    }));

    if (profile?.user_id) {
      const { data: reads } = await supabase.from('notifications').select('link').eq('user_id', profile.user_id).like('link', '%noticeboard%');
      // We use read_at on notifications as a proxy; simpler: just check a local set
    }

    setItems(mapped);
    setHasMore(announcements.length === PAGE_SIZE);
    setLoading(false);
  }, [profile?.school_id, profile?.user_id, profile?.role, childLoading, children]);

  useEffect(() => { loadInitial(); }, [loadInitial]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextOffset = (page + 1) * PAGE_SIZE;
    const q = buildQuery(nextOffset);
    if (!q) { setLoadingMore(false); return; }
    const { data } = await q;
    const announcements = (data as any[]) ?? [];
    const mapped: NoticeItem[] = announcements.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body ?? '',
      author_id: a.author_id,
      authorName: authorMap[a.author_id] ?? 'School',
      audience: a.audience,
      class_id: a.class_id,
      className: a.class_id ? (classMap[a.class_id] ?? null) : null,
      created_at: a.created_at,
      read: false,
    }));
    setItems((prev) => [...prev, ...mapped]);
    setPage((prev) => prev + 1);
    setHasMore(announcements.length === PAGE_SIZE);
    setLoadingMore(false);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadInitial();
    setRefreshing(false);
  }, [loadInitial]);

  const openItem = (item: NoticeItem) => {
    setSelected(item);
    setItems((prev) => prev.map((it) => it.id === item.id ? { ...it, read: true } : it));
  };

  const formatAudience = (audience: string, className: string | null) => {
    switch (audience) {
      case 'school': return 'All School';
      case 'parents': return 'All Parents';
      case 'teachers': return 'All Teachers';
      case 'staff': return 'Staff';
      case 'class': return className ? `Class ${className}` : 'Class';
      case 'class_all': return className ? `Class ${className}` : 'Class';
      case 'emergency': return 'Emergency';
      default: return audience;
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${time}, ${formatDate(iso)}`;
  };

  if (loading) return <Loading />;

  if (selected) {
    return (
      <View style={styles.screen}>
        <View style={{ padding: 20, paddingBottom: 8 }}>
          <Pressable onPress={() => setSelected(null)}><Text style={{ color: colors.primary, fontWeight: '700' }}>‹ Back to Noticeboard</Text></Pressable>
        </View>
        <FlatList
          data={[selected]}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{ padding: 20, paddingTop: 8 }}
          renderItem={({ item }) => (
            <View>
              <Text style={{ fontSize: 22, fontWeight: '700', color: colors.ink }}>{item.title}</Text>
              <View style={{ marginTop: 10, gap: 4 }}>
                <Text style={{ color: colors.muted, fontSize: 13 }}>Sent: {formatTime(item.created_at)}</Text>
                <Text style={{ color: colors.muted, fontSize: 13 }}>From: {item.authorName}</Text>
                <Text style={{ color: colors.muted, fontSize: 13 }}>To: {formatAudience(item.audience, item.className)}</Text>
              </View>
              <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 16, paddingTop: 16 }}>
                <Text style={{ color: colors.ink, fontSize: 16, lineHeight: 26 }}>{item.body}</Text>
              </View>
            </View>
          )}
        />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      data={items}
      keyExtractor={(x) => x.id}
      contentContainerStyle={{ padding: 20, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      ListHeaderComponent={
        <View style={{ marginBottom: 16 }}>
          <Text style={styles.eyebrow}>School messages</Text>
          <Text style={styles.title}>Noticeboard</Text>
          <Text style={styles.subtitle}>Latest notices and announcements</Text>
        </View>
      }
      ListEmptyComponent={<Card><Empty title="No notices" body="School announcements will appear here." /></Card>}
      renderItem={({ item }) => (
        <Pressable onPress={() => openItem(item)}>
          <Card>
            <View style={styles.row}>
              <Megaphone color={item.read ? colors.muted : colors.primary} size={20} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {!item.read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />}
                  <Text style={{ fontWeight: '700', color: colors.ink, flex: 1 }} numberOfLines={1}>{item.title}</Text>
                </View>
                <Text style={{ color: colors.muted, marginTop: 4, fontSize: 12 }}>{formatTime(item.created_at)}</Text>
                <Text style={{ color: colors.muted, marginTop: 2, fontSize: 12 }}>From: {item.authorName} · To: {formatAudience(item.audience, item.className)}</Text>
                <Text style={{ color: colors.muted, marginTop: 6, fontSize: 14 }} numberOfLines={2}>{item.body}</Text>
              </View>
              <ChevronRight color={colors.muted} size={18} />
            </View>
          </Card>
        </Pressable>
      )}
      ListFooterComponent={
        hasMore ? (
          <Pressable onPress={loadMore} disabled={loadingMore} style={{ alignItems: 'center', paddingVertical: 16, marginTop: 8 }}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>{loadingMore ? 'Loading…' : 'Load More'}</Text>
          </Pressable>
        ) : items.length > 0 ? (
          <Text style={{ color: colors.muted, textAlign: 'center', paddingVertical: 16 }}>No more messages</Text>
        ) : null
      }
    />
  );
}
