"""
Process character model in Blender.
- Import GLB
- Generate or enhance a rig
- Add weapon sockets and IK targets
- Export optimized GLB
"""

import bpy
import json
import math
import os
import sys
from mathutils import Matrix, Vector


def process_character(args):
    input_path = args.get("input_path")
    output_path = args.get("output_path")
    add_weapon_sockets = args.get("add_weapon_sockets", True)
    add_ik_targets = args.get("add_ik_targets", True)
    draco_compression = args.get("draco_compression", True)

    print("\n[ProcessCharacter] Starting...")
    print(f"  Input: {input_path}")
    print(f"  Output: {output_path}")

    if not input_path or not output_path:
        raise ValueError("input_path and output_path are required")

    print("[1/5] Clearing scene...")
    clear_scene()

    print("[2/5] Importing model...")
    bpy.ops.import_scene.gltf(filepath=input_path)
    mesh_objects = get_mesh_objects()
    if not mesh_objects:
        raise RuntimeError("No mesh objects found after import")
    print(f"  ✓ Imported {len(mesh_objects)} mesh object(s)")

    print("[3/5] Preparing armature...")
    armature = find_armature()
    if armature:
        bake_import_transforms(mesh_objects, armature)
        print(f"  ✓ Found existing armature: {armature.name}")
    else:
        bake_import_transforms(mesh_objects, None)
        armature = create_humanoid_armature(mesh_objects)
        print(f"  ✓ Generated armature: {armature.name}")

    normalize_character_origin(mesh_objects, armature)

    if not has_armature_modifier(mesh_objects, armature):
        bind_meshes_to_armature(mesh_objects, armature)

    print("[4/5] Adding sockets and IK targets...")
    ensure_attachment_bones(armature, add_weapon_sockets, add_ik_targets)
    print("  ✓ Rig enhancement complete")

    print("[5/5] Baking idle animation...")
    ensure_idle_action(armature)
    print("  ✓ Idle action created")

    print("[6/6] Exporting GLB...")
    export_glb(output_path, draco_compression)
    size_mb = os.path.getsize(output_path) / 1024 / 1024
    print(f"  ✓ GLB exported: {size_mb:.2f}MB")

    print("\n✅ Processing complete!")
    return True


def clear_scene():
    try:
        bpy.ops.object.mode_set(mode="OBJECT")
    except Exception:
        pass

    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)

    for collection in list(bpy.data.collections):
        if collection.users == 0:
            bpy.data.collections.remove(collection)

    purge_orphans()


def purge_orphans():
    datablocks = [
        bpy.data.meshes,
        bpy.data.armatures,
        bpy.data.materials,
        bpy.data.images,
        bpy.data.cameras,
        bpy.data.lights,
    ]

    for datablock in datablocks:
        for item in list(datablock):
            if item.users == 0:
                datablock.remove(item)

    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)


def get_mesh_objects():
    return [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]


def find_armature():
    for obj in bpy.context.scene.objects:
        if obj.type == "ARMATURE":
            return obj
    return None


def bake_import_transforms(mesh_objects, armature):
    if armature:
        bake_armature_object_transform(armature)

    for mesh in mesh_objects:
        bake_mesh_object_transform(mesh)


def bake_mesh_object_transform(mesh):
    transform = mesh.matrix_local.copy()
    mesh.data.transform(transform)
    clear_object_transform(mesh)


def bake_armature_object_transform(armature):
    transform = armature.matrix_world.copy()
    if is_identity_matrix(transform):
        return

    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode="EDIT")
    for bone in armature.data.edit_bones:
        bone.transform(transform)
    bpy.ops.object.mode_set(mode="OBJECT")
    clear_object_transform(armature)


def clear_object_transform(obj):
    obj.location = (0.0, 0.0, 0.0)
    if hasattr(obj, "rotation_quaternion"):
        obj.rotation_quaternion = (1.0, 0.0, 0.0, 0.0)
    obj.rotation_euler = (0.0, 0.0, 0.0)
    obj.scale = (1.0, 1.0, 1.0)


def is_identity_matrix(matrix):
    return all(abs(matrix[row][col] - (1.0 if row == col else 0.0)) < 1e-6 for row in range(4) for col in range(4))


def create_humanoid_armature(mesh_objects):
    points = sample_world_vertices(mesh_objects)
    bounds = compute_bounds(points)
    landmarks = estimate_landmarks(points, bounds)

    armature_data = bpy.data.armatures.new("ArmatureData")
    armature = bpy.data.objects.new("Armature", armature_data)
    bpy.context.scene.collection.objects.link(armature)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode="EDIT")

    edit_bones = armature.data.edit_bones

    def add_bone(name, head, tail, parent=None, connected=False, deform=True):
        bone = edit_bones.new(name)
        bone.head = head
        bone.tail = tail
        bone.use_deform = deform
        if parent:
            bone.parent = parent
            bone.use_connect = connected
        return bone

    hips = add_bone("mixamorigHips", landmarks["hips"], landmarks["spine"])
    spine = add_bone("mixamorigSpine", landmarks["spine"], landmarks["chest"], hips, True)
    chest = add_bone("mixamorigSpine1", landmarks["chest"], landmarks["upper_chest"], spine, True)
    upper_chest = add_bone("mixamorigSpine2", landmarks["upper_chest"], landmarks["neck"], chest, True)
    neck = add_bone("mixamorigNeck", landmarks["neck"], landmarks["head"], upper_chest, True)
    add_bone("mixamorigHead", landmarks["head"], landmarks["head_tip"], neck, True)

    left_upper_leg = add_bone("mixamorigLeftUpLeg", landmarks["left_hip"], landmarks["left_knee"], hips)
    left_lower_leg = add_bone("mixamorigLeftLeg", landmarks["left_knee"], landmarks["left_ankle"], left_upper_leg, True)
    left_foot = add_bone("mixamorigLeftFoot", landmarks["left_ankle"], landmarks["left_toe"], left_lower_leg, True)
    add_bone("mixamorigLeftToeBase", landmarks["left_toe"], landmarks["left_toe_tip"], left_foot, True)

    right_upper_leg = add_bone("mixamorigRightUpLeg", landmarks["right_hip"], landmarks["right_knee"], hips)
    right_lower_leg = add_bone("mixamorigRightLeg", landmarks["right_knee"], landmarks["right_ankle"], right_upper_leg, True)
    right_foot = add_bone("mixamorigRightFoot", landmarks["right_ankle"], landmarks["right_toe"], right_lower_leg, True)
    add_bone("mixamorigRightToeBase", landmarks["right_toe"], landmarks["right_toe_tip"], right_foot, True)

    left_shoulder = add_bone("mixamorigLeftShoulder", landmarks["left_shoulder"], landmarks["left_upper_arm"], upper_chest)
    left_upper_arm = add_bone("mixamorigLeftArm", landmarks["left_upper_arm"], landmarks["left_elbow"], left_shoulder, True)
    left_lower_arm = add_bone("mixamorigLeftForeArm", landmarks["left_elbow"], landmarks["left_wrist"], left_upper_arm, True)
    add_bone("mixamorigLeftHand", landmarks["left_wrist"], landmarks["left_hand_tip"], left_lower_arm, True)

    right_shoulder = add_bone("mixamorigRightShoulder", landmarks["right_shoulder"], landmarks["right_upper_arm"], upper_chest)
    right_upper_arm = add_bone("mixamorigRightArm", landmarks["right_upper_arm"], landmarks["right_elbow"], right_shoulder, True)
    right_lower_arm = add_bone("mixamorigRightForeArm", landmarks["right_elbow"], landmarks["right_wrist"], right_upper_arm, True)
    add_bone("mixamorigRightHand", landmarks["right_wrist"], landmarks["right_hand_tip"], right_lower_arm, True)

    bpy.ops.object.mode_set(mode="OBJECT")
    armature.show_in_front = True
    return armature


def sample_world_vertices(mesh_objects):
    points = []
    total_vertices = sum(len(obj.data.vertices) for obj in mesh_objects)
    step = max(1, total_vertices // 50000)

    for obj in mesh_objects:
        matrix = obj.matrix_world
        for index, vertex in enumerate(obj.data.vertices):
            if index % step == 0:
                points.append(matrix @ vertex.co)

    if not points:
        raise RuntimeError("Could not sample any mesh vertices")

    return points


def compute_bounds(points):
    min_corner = Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points)))
    max_corner = Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points)))
    return min_corner, max_corner


def estimate_landmarks(points, bounds):
    min_corner, max_corner = bounds
    center = (min_corner + max_corner) * 0.5
    size = max_corner - min_corner
    height = max(size.z, 0.1)
    width = max(size.x, 0.1)
    depth = max(size.y, 0.1)

    left_points = [point for point in points if point.x >= center.x]
    right_points = [point for point in points if point.x < center.x]
    bottom_points = [point for point in points if point.z <= min_corner.z + height * 0.08]

    left_hand_source = select_extreme(left_points, lambda point: point.x, min_corner.z + height * 0.35, min_corner.z + height * 0.88)
    right_hand_source = select_extreme(right_points, lambda point: -point.x, min_corner.z + height * 0.35, min_corner.z + height * 0.88)

    left_foot_source = average_points([point for point in bottom_points if point.x >= center.x]) or Vector((center.x + width * 0.12, center.y, min_corner.z))
    right_foot_source = average_points([point for point in bottom_points if point.x < center.x]) or Vector((center.x - width * 0.12, center.y, min_corner.z))

    hips = Vector((center.x, center.y, min_corner.z + height * 0.53))
    spine = Vector((center.x, center.y, min_corner.z + height * 0.62))
    chest = Vector((center.x, center.y, min_corner.z + height * 0.76))
    upper_chest = Vector((center.x, center.y, min_corner.z + height * 0.83))
    neck = Vector((center.x, center.y, min_corner.z + height * 0.87))
    head = Vector((center.x, center.y, min_corner.z + height * 0.94))
    head_tip = Vector((center.x, center.y, max_corner.z))

    left_wrist = Vector((left_hand_source.x, center.y, left_hand_source.z))
    right_wrist = Vector((right_hand_source.x, center.y, right_hand_source.z))

    arm_z = max(chest.z - height * 0.02, max(left_wrist.z, right_wrist.z))
    shoulder_offset = max(width * 0.08, abs(left_wrist.x - center.x) * 0.22)

    left_shoulder = Vector((center.x + shoulder_offset, center.y, arm_z))
    right_shoulder = Vector((center.x - shoulder_offset, center.y, arm_z))
    left_upper_arm = Vector((lerp(left_shoulder.x, left_wrist.x, 0.25), center.y, lerp(left_shoulder.z, left_wrist.z, 0.25)))
    right_upper_arm = Vector((lerp(right_shoulder.x, right_wrist.x, 0.25), center.y, lerp(right_shoulder.z, right_wrist.z, 0.25)))
    left_elbow = Vector((lerp(left_shoulder.x, left_wrist.x, 0.58), center.y, lerp(left_shoulder.z, left_wrist.z, 0.58)))
    right_elbow = Vector((lerp(right_shoulder.x, right_wrist.x, 0.58), center.y, lerp(right_shoulder.z, right_wrist.z, 0.58)))
    left_hand_tip = left_wrist + Vector((max(width * 0.04, 0.03), 0.0, -height * 0.01))
    right_hand_tip = right_wrist + Vector((-max(width * 0.04, 0.03), 0.0, -height * 0.01))

    hip_span = max(width * 0.09, 0.03)
    knee_z = min_corner.z + height * 0.28
    ankle_z = min_corner.z + height * 0.05
    foot_forward = max(depth * 0.18, 0.04)

    left_hip = Vector((center.x + hip_span, center.y, hips.z))
    right_hip = Vector((center.x - hip_span, center.y, hips.z))
    left_knee = Vector((left_hip.x, center.y, knee_z))
    right_knee = Vector((right_hip.x, center.y, knee_z))
    left_ankle = Vector((left_foot_source.x, center.y, ankle_z))
    right_ankle = Vector((right_foot_source.x, center.y, ankle_z))
    left_toe = left_ankle + Vector((0.0, foot_forward, 0.0))
    right_toe = right_ankle + Vector((0.0, foot_forward, 0.0))
    left_toe_tip = left_toe + Vector((0.0, foot_forward * 0.4, 0.0))
    right_toe_tip = right_toe + Vector((0.0, foot_forward * 0.4, 0.0))

    return {
        "hips": hips,
        "spine": spine,
        "chest": chest,
        "upper_chest": upper_chest,
        "neck": neck,
        "head": head,
        "head_tip": head_tip,
        "left_hip": left_hip,
        "right_hip": right_hip,
        "left_knee": left_knee,
        "right_knee": right_knee,
        "left_ankle": left_ankle,
        "right_ankle": right_ankle,
        "left_toe": left_toe,
        "right_toe": right_toe,
        "left_toe_tip": left_toe_tip,
        "right_toe_tip": right_toe_tip,
        "left_shoulder": left_shoulder,
        "right_shoulder": right_shoulder,
        "left_upper_arm": left_upper_arm,
        "right_upper_arm": right_upper_arm,
        "left_elbow": left_elbow,
        "right_elbow": right_elbow,
        "left_wrist": left_wrist,
        "right_wrist": right_wrist,
        "left_hand_tip": left_hand_tip,
        "right_hand_tip": right_hand_tip,
    }


def select_extreme(points, key_fn, min_z, max_z):
    filtered = [point for point in points if min_z <= point.z <= max_z]
    if filtered:
        return max(filtered, key=key_fn)
    if points:
        return max(points, key=key_fn)
    return Vector((0.0, 0.0, 0.0))


def average_points(points):
    if not points:
        return None
    total = Vector((0.0, 0.0, 0.0))
    for point in points:
        total += point
    return total / len(points)


def lerp(start, end, factor):
    return start + (end - start) * factor


def bind_meshes_to_armature(mesh_objects, armature):
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = armature
    armature.select_set(True)

    for mesh in mesh_objects:
        mesh.select_set(True)

    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    bpy.ops.object.select_all(action="DESELECT")


def has_armature_modifier(mesh_objects, armature):
    for mesh in mesh_objects:
        for modifier in mesh.modifiers:
            if modifier.type == "ARMATURE" and modifier.object == armature:
                return True
    return False


def normalize_character_origin(mesh_objects, armature):
    bounds = get_world_bounds(mesh_objects)
    hips_location = get_hips_location(armature)

    center_x = hips_location.x if hips_location else (bounds["min"].x + bounds["max"].x) * 0.5
    center_y = hips_location.y if hips_location else (bounds["min"].y + bounds["max"].y) * 0.5
    offset = Vector((-center_x, -center_y, -bounds["min"].z))

    if offset.length < 1e-6:
        return

    translation = Matrix.Translation(offset)

    for mesh in mesh_objects:
        mesh.data.transform(translation)

    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode="EDIT")
    for bone in armature.data.edit_bones:
        bone.transform(translation)
    bpy.ops.object.mode_set(mode="OBJECT")


def get_world_bounds(mesh_objects):
    points = []
    for mesh in mesh_objects:
        points.extend(mesh.matrix_world @ vertex.co for vertex in mesh.data.vertices)

    if not points:
        raise RuntimeError("Could not compute mesh bounds")

    return {
        "min": Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points))),
        "max": Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points))),
    }


def get_hips_location(armature):
    hips_name = find_bone_name(armature, ["mixamorigHips", "mixamorig:Hips", "hips", "Hips"])
    if not hips_name:
        return None

    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode="EDIT")
    location = armature.data.edit_bones[hips_name].head.copy()
    bpy.ops.object.mode_set(mode="OBJECT")
    return location


def ensure_attachment_bones(armature, add_weapon_sockets=True, add_ik_targets=True):
    right_hand_name = find_bone_name(armature, ["mixamorigRightHand", "mixamorig:RightHand", "RightHand", "rightHand", "Hand.R"])
    left_hand_name = find_bone_name(armature, ["mixamorigLeftHand", "mixamorig:LeftHand", "LeftHand", "leftHand", "Hand.L"])

    if not right_hand_name and not left_hand_name:
        raise RuntimeError("Could not find hand bones for socket generation")

    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode="EDIT")
    edit_bones = armature.data.edit_bones

    if add_weapon_sockets and right_hand_name:
        ensure_child_bone(edit_bones, "weapon_socket_r", right_hand_name, Vector((0.06, 0.0, 0.0)), deform=False)
    if add_weapon_sockets and left_hand_name:
        ensure_child_bone(edit_bones, "weapon_socket_l", left_hand_name, Vector((-0.06, 0.0, 0.0)), deform=False)

    if add_ik_targets and right_hand_name:
        ensure_child_bone(edit_bones, "ik_target_hand_r", right_hand_name, Vector((0.12, 0.12, 0.0)), deform=False)
    if add_ik_targets and left_hand_name:
        ensure_child_bone(edit_bones, "ik_target_hand_l", left_hand_name, Vector((-0.12, 0.12, 0.0)), deform=False)

    bpy.ops.object.mode_set(mode="OBJECT")


def ensure_idle_action(armature):
    if armature.animation_data is None:
        armature.animation_data_create()

    action = bpy.data.actions.new("Idle")
    armature.animation_data.action = action

    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.mode_set(mode="POSE")

    for pose_bone in armature.pose.bones:
        pose_bone.rotation_mode = "XYZ"
        pose_bone.location = (0.0, 0.0, 0.0)
        pose_bone.rotation_euler = (0.0, 0.0, 0.0)

    set_idle_pose(armature, 1, 0.0)
    set_idle_pose(armature, 15, 1.0)
    set_idle_pose(armature, 30, 0.0)

    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 30
    bpy.context.scene.frame_set(1)
    bpy.ops.object.mode_set(mode="OBJECT")


def set_idle_pose(armature, frame, weight):
    bpy.context.scene.frame_set(frame)

    rotations = {
        ("mixamorigSpine", "mixamorig:Spine"): (math.radians(1.0 * weight), 0.0, 0.0),
        ("mixamorigSpine1", "mixamorig:Spine1"): (math.radians(-1.2 * weight), 0.0, 0.0),
        ("mixamorigSpine2", "mixamorig:Spine2"): (math.radians(1.6 * weight), 0.0, 0.0),
        ("mixamorigNeck", "mixamorig:Neck"): (math.radians(-0.6 * weight), 0.0, 0.0),
        ("mixamorigLeftArm", "mixamorig:LeftArm"): (0.0, 0.0, math.radians(-2.0 * weight)),
        ("mixamorigRightArm", "mixamorig:RightArm"): (0.0, 0.0, math.radians(2.0 * weight)),
        ("mixamorigLeftForeArm", "mixamorig:LeftForeArm"): (math.radians(-1.2 * weight), 0.0, 0.0),
        ("mixamorigRightForeArm", "mixamorig:RightForeArm"): (math.radians(-1.2 * weight), 0.0, 0.0),
    }

    for aliases, rotation in rotations.items():
        bone_name = find_bone_name(armature, list(aliases))
        pose_bone = armature.pose.bones.get(bone_name) if bone_name else None
        if not pose_bone:
            continue
        pose_bone.rotation_euler = rotation
        pose_bone.keyframe_insert(data_path="rotation_euler", frame=frame)


def ensure_child_bone(edit_bones, child_name, parent_name, offset, deform):
    if child_name in edit_bones:
        return

    parent = edit_bones[parent_name]
    bone = edit_bones.new(child_name)
    bone.parent = parent
    bone.use_connect = False
    bone.use_deform = deform
    bone.head = parent.tail
    bone.tail = parent.tail + offset


def find_bone_name(armature, bone_names):
    for name in bone_names:
        if name in armature.data.bones:
            return name
    return None


def export_glb(output_path, draco_compression):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format="GLB",
        export_draco_mesh_compression_enable=draco_compression,
        export_draco_mesh_compression_level=10,
        export_image_format="WEBP" if draco_compression else "AUTO",
        export_texture_dir="",
        export_keep_originals=False,
        export_animations=True,
        export_skins=True,
        export_morph=True,
        export_lights=False,
        export_cameras=False,
    )


def parse_args():
    if "SCRIPT_ARGS" in globals():
        return SCRIPT_ARGS

    if "--" not in sys.argv:
        return {}

    args_index = sys.argv.index("--") + 1
    if args_index >= len(sys.argv):
        return {}

    return json.loads(sys.argv[args_index])


def main():
    success = process_character(parse_args())
    if globals().get("IN_MCP"):
        if not success:
            raise RuntimeError("Character processing failed")
        return
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
