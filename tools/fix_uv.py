# ================================================================
# Blender 自动 UV 修复脚本 — 为 AI 文创模型适配单张贴图
# ================================================================
# 功能：
#   1. 导入 glb/fbx/obj/usdz 模型
#   2. 检测 UV 是否合理（单面展开？UV 超出 [0,1]？）
#   3. 重新 UV 展开（默认 Lightmap Pack：把所有面紧凑排布到 0~1 空间）
#   4. 可选：把模型包围盒归一化到单位尺寸 + 底面落 y=0
#   5. 导出 glb（保留原始材质 + 新 UV）
#
# 为什么用 Lightmap Pack？
#   Smart UV Project 按法线角度拆岛 → Organic 模型友好但可能有重叠
#   Lightmap Pack 把所有 UV 岛**紧凑铺到一张 0~1 的图上、无重叠**
#   → 完美适配"创意图案是一张 0~1 画布、所有面都要印图案"的文创场景
#
# 使用方法（Windows）：
#   blender --background --python tools\fix_uv.py -- 书签.glb 书签_fixed.glb
#   blender --background --python tools\fix_uv.py -- 书签.glb 书签_fixed.glb --method lightmap --normalize
#   blender --background --python tools\fix_uv.py -- 书签.glb 书签_fixed.glb --method smart
#
#   如果 `blender` 不在 PATH，用完整路径：
#   "C:\Program Files\Blender Foundation\Blender 4.1\blender.exe" --background --python tools\fix_uv.py -- 书签.glb 书签_fixed.glb
# ================================================================

import bpy
import bmesh
import sys
import os
import argparse


# ---- 1. 场景清理 -----------------------------------------------------------

def clear_scene():
    """删除默认立方体、摄像机、光源（只保留导入的模型）"""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    # 删除孤立数据
    for block in bpy.data.meshes:
        if block.users == 0:
            bpy.data.meshes.remove(block)


# ---- 2. 模型导入 -----------------------------------------------------------

def load_model(path):
    """按扩展名自动选择导入器"""
    ext = os.path.splitext(path)[1].lower()
    if ext == '.glb':
        bpy.ops.import_scene.gltf(filepath=path)
    elif ext == '.gltf':
        bpy.ops.import_scene.gltf(filepath=path)
    elif ext == '.fbx':
        bpy.ops.import_scene.fbx(filepath=path)
    elif ext == '.obj':
        bpy.ops.import_scene.obj(filepath=path)
    elif ext == '.usdz' or ext == '.usd':
        bpy.ops.wm.usd_import(filepath=path)
    else:
        raise ValueError(f'不支持的格式: {ext}（支持 .glb/.gltf/.fbx/.obj/.usdz）')


# ---- 3. UV 诊断 ------------------------------------------------------------

def diagnose_uvs():
    """扫描所有 mesh 的 UV，返回诊断报告"""
    report = []
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH':
            continue
        mesh = obj.data
        if not mesh.uv_layers:
            report.append((obj.name, 'NO_UV', None))
            continue
        uv_layer = mesh.uv_layers[0]
        us = [uv.data[i].uv[0] for i in range(len(mesh.loops))]
        vs = [uv.data[i].uv[1] for i in range(len(mesh.loops))]
        u_range = (min(us), max(us))
        v_range = (min(vs), max(vs))
        # 判断是否"单面展开"：所有 UV 都在 [0.01, 0.99] 内，说明只占了一小部分
        single_face = (u_range[0] > 0.01 and u_range[1] < 0.99
                       and v_range[0] > 0.01 and v_range[1] < 0.99)
        # 判断是否有重叠 / 超出
        out_of_bounds = u_range[0] < -0.01 or u_range[1] > 1.01 or \
                        v_range[0] < -0.01 or v_range[1] > 1.01
        flag = 'OK'
        if single_face:
            flag = 'SINGLE_FACE'
        elif out_of_bounds:
            flag = 'OUT_OF_BOUNDS'
        report.append((obj.name, flag, (u_range, v_range)))
    return report


# ---- 4. UV 修复 ------------------------------------------------------------

def fix_uvs(method='lightmap', margin=0.02):
    """
    为所有 mesh 重新展开 UV
    method: 'lightmap' → Lightmap Pack（硬表面友好，紧凑排布到 0~1）
            'smart'    → Smart UV Project（Organic 友好，按法线拆岛）
    margin:  UV 岛之间的间距（防止纹理漏缝）
    """
    total = len([o for o in bpy.context.scene.objects if o.type == 'MESH'])
    idx = 0
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH':
            continue
        idx += 1
        mesh = obj.data

        # 确保有 UV 层
        if not mesh.uv_layers:
            mesh.uv_layers.new(name='UVMap')
            print(f'  [{idx}/{total}] {obj.name}: 新建 UV 层')
        else:
            print(f'  [{idx}/{total}] {obj.name}: 已有 UV 层，重新展开')

        # 备份原始 UV（存到第二层，导出时会被带上方便调试）
        if len(mesh.uv_layers) < 2:
            backup = mesh.uv_layers.new(name='UVMap_Backup')
            for i in range(len(mesh.loops)):
                backup.data[i].uv = mesh.uv_layers[0].data[i].uv.copy()

        # 激活第一层作为操作目标
        mesh.uv_layers[0].active = True
        mesh.uv_layers[0].active_render = True

        # 进入 Edit Mode
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')

        if method == 'lightmap':
            # Lightmap Pack：紧凑排布到 0~1 空间
            bpy.ops.uv.lightmap_pack(
                PREF_CONTEXT='ALL_FACES',
                PREF_PACK_IN_ONE=True,      # 所有岛打包到一张图
                PREF_NEW_UVLAYER=False,     # 覆盖当前层（不是新建）
                PREF_BOX_DIM=256,           # 打包精度
                PREF_MARGIN_DIV=margin * 100,  # 岛间距 %
            )
        else:  # smart
            # Smart UV Project：基于法线角度拆岛
            bpy.ops.uv.smart_project(
                angle_limit=1.15192,        # ~66°，默认阈值
                island_margin=margin,
                area_weight=0.1,
                correct_aspect=True,
                scale_to_bounds=False,
            )

        bpy.ops.object.mode_set(mode='OBJECT')
        obj.select_set(False)

    print(f'✅ UV 修复完成：{idx} 个 mesh')


# ---- 5. 归一化（可选） ------------------------------------------------------

def normalize_bounds():
    """把模型缩放到单位尺寸 + 底面落 y=0，和我们 three.js 预览逻辑对齐"""
    if not [o for o in bpy.context.scene.objects if o.type == 'MESH']:
        return
    # 应用当前 transform
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.select_all(action='DESELECT')

    # 计算整体 bounding box
    min_coords = [float('inf'), float('inf'), float('inf')]
    max_coords = [float('-inf'), float('-inf'), float('-inf')]
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH':
            continue
        world_matrix = obj.matrix_world
        for v in obj.data.vertices:
            wc = world_matrix @ v.co
            for i in range(3):
                if wc[i] < min_coords[i]:
                    min_coords[i] = wc[i]
                if wc[i] > max_coords[i]:
                    max_coords[i] = wc[i]

    size = [max_coords[i] - min_coords[i] for i in range(3)]
    max_dim = max(size)
    if max_dim == 0:
        return

    # 缩放 + 平移
    scale_factor = 1.0 / max_dim
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH':
            continue
        # 绕原点缩放（Blender 原点 = 世界原点）
        obj.scale = (obj.scale[0] * scale_factor,
                     obj.scale[1] * scale_factor,
                     obj.scale[2] * scale_factor)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.ops.object.select_all(action='DESELECT')

    # 底面落 y=0
    new_min_z = min(co.z for obj in bpy.context.scene.objects
                    if obj.type == 'MESH' for co in obj.data.vertices)
    if abs(new_min_z) > 0.001:
        for obj in bpy.context.scene.objects:
            if obj.type == 'MESH':
                obj.location.z -= new_min_z

    print(f'✅ 归一化：尺寸 {size[0]:.3f}×{size[1]:.3f}×{size[2]:.3f} → 缩放到 1.0')


# ---- 6. 导出 ---------------------------------------------------------------

def export_model(path, export_materials=True):
    ext = os.path.splitext(path)[1].lower()
    if ext == '.glb':
        bpy.ops.export_scene.gltf(
            filepath=path,
            export_format='GLB',
            export_texcoords=True,
            export_morph=False,
            export_animations=False,
            export_materials='EXPORT' if export_materials else 'NONE',
            export_colors=True,
            export_cameras=False,
            export_lights=False,
            export_apply=True,
            export_uv=True,
            export_all_vertex_colors=False,
        )
    else:
        raise ValueError(f'暂只支持导出 .glb（当前: {ext}）')
    print(f'✅ 导出完成：{path}')


# ---- 7. 入口 ---------------------------------------------------------------

def main():
    # Blender 的命令行参数：-- 之前是 Blender 自己的，之后才是脚本参数
    # 调用示例: blender --background --python fix_uv.py -- input.glb output.glb --method lightmap
    argv = sys.argv
    if '--' in argv:
        argv = argv[argv.index('--') + 1:]
    else:
        # 没传 -- 也没传参数，打印用法
        if len(argv) <= 2:
            print('用法: blender --background --python fix_uv.py -- <输入.glb> [输出.glb] [--method lightmap|smart] [--normalize]')
            sys.exit(0)

    parser = argparse.ArgumentParser(description='AI 文创模型 UV 自动修复')
    parser.add_argument('input', help='输入模型 (.glb/.fbx/.obj/.usdz)')
    parser.add_argument('output', nargs='?', help='输出路径（默认 <输入>_fixed.glb）')
    parser.add_argument('--method', choices=['lightmap', 'smart'], default='lightmap',
                        help='UV 展开方式（默认 lightmap：紧凑排布到 0~1 空间）')
    parser.add_argument('--normalize', action='store_true',
                        help='额外归一化模型尺寸（缩放到 1.0 + 底面落 y=0）')
    parser.add_argument('--margin', type=float, default=0.02,
                        help='UV 岛间距（默认 0.02，防止纹理漏缝）')
    args = parser.parse_args(argv)

    input_path = os.path.abspath(args.input)
    output_path = args.output or os.path.splitext(input_path)[0] + '_fixed.glb'
    output_path = os.path.abspath(output_path)

    print('=' * 60)
    print(f'📥 输入:     {input_path}')
    print(f'📤 输出:     {output_path}')
    print(f'🔧 UV 方式: {args.method}')
    print(f'📐 归一化:   {"是" if args.normalize else "否"}')
    print('=' * 60)

    if not os.path.exists(input_path):
        print(f'❌ 找不到文件: {input_path}')
        sys.exit(1)

    try:
        clear_scene()
        load_model(input_path)

        # 诊断
        print('\n--- UV 诊断 ---')
        diag = diagnose_uvs()
        for name, flag, ranges in diag:
            if flag == 'OK':
                print(f'  🟢 {name}: UV U[{ranges[0][0]:.2f},{ranges[0][1]:.2f}] V[{ranges[1][0]:.2f},{ranges[1][1]:.2f}]')
            else:
                reason = '单面展开' if flag == 'SINGLE_FACE' else '超出 0~1'
                print(f'  🔴 {name}: {reason}  U[{ranges[0][0]:.2f},{ranges[0][1]:.2f}] V[{ranges[1][0]:.2f},{ranges[1][1]:.2f}]')

        # 修复
        print(f'\n--- UV 修复 ({args.method}) ---')
        fix_uvs(method=args.method, margin=args.margin)

        # 验证修复后
        print('\n--- 修复后 UV ---')
        diag2 = diagnose_uvs()
        all_ok = True
        for name, flag, ranges in diag2:
            if flag == 'OK':
                print(f'  🟢 {name}: 全部 UV 在 [0,1] 内')
            else:
                print(f'  🟡 {name}: {flag}（可能需要手动处理）')
                all_ok = False

        if args.normalize:
            print('\n--- 归一化 ---')
            normalize_bounds()

        print('\n--- 导出 ---')
        export_model(output_path)

        print('\n🎉 全部完成！')
        print(f'提示：把 {os.path.basename(output_path)} 重新上传到管理后台即可')

    except Exception as e:
        print(f'\n❌ 出错了: {e}')
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
